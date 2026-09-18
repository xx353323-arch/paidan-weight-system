from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.response import ok
from app.db.base import now
from app.db.session import get_db
from app.models import ConfigGradeBand, Employee, EmployeeTag, EvalPeriod, Tag, WeightSnapshot

router = APIRouter(prefix="/public", tags=["公开榜单"])

_lookup_hits: dict[str, list[float]] = {}
LOOKUP_LIMIT = 20
LOOKUP_WINDOW = 60.0


def mask_name(name: str) -> str:
    if not name:
        return ""
    if len(name) == 1:
        return name
    return name[0] + "*" * (len(name) - 1)


def _published_period(db: Session) -> EvalPeriod | None:
    period_id = db.scalar(
        select(WeightSnapshot.period_id).where(WeightSnapshot.is_published).order_by(WeightSnapshot.period_id.desc())
    )
    return db.get(EvalPeriod, period_id) if period_id else None


def _grade_colors(db: Session, config_id: int | None) -> dict[str, str]:
    if not config_id:
        return {}
    return {
        b.code: b.color
        for b in db.scalars(select(ConfigGradeBand).where(ConfigGradeBand.config_id == config_id))
    }


def _group_map(db: Session, employee_ids: list[int]) -> dict[int, tuple[str, int]]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EmployeeTag.employee_id, Tag.name, Tag.sort_order)
        .join(Tag, Tag.id == EmployeeTag.tag_id)
        .where(EmployeeTag.employee_id.in_(employee_ids), Tag.is_group)
        .order_by(Tag.sort_order)
    ).all()
    result: dict[int, tuple[str, int]] = {}
    for employee_id, name, sort_order in rows:
        result.setdefault(employee_id, (name, sort_order))
    return result


def _build_rows(db: Session, period: EvalPeriod) -> list[dict]:
    rows = db.execute(
        select(WeightSnapshot, Employee)
        .join(Employee, Employee.id == WeightSnapshot.employee_id)
        .where(WeightSnapshot.period_id == period.id, WeightSnapshot.is_published)
    ).all()
    groups = _group_map(db, [e.id for _, e in rows])
    colors = _grade_colors(db, period.config_id)

    items = []
    for snapshot, employee in rows:
        group_name, group_sort = groups.get(employee.id, ("未分组", 9999))
        items.append(
            {
                "employeeId": employee.id,
                "empNo": employee.emp_no,
                "name": employee.name,
                "maskedName": mask_name(employee.name),
                "wFinal": snapshot.w_final,
                "gradeCode": snapshot.grade_code,
                "gradeColor": colors.get(snapshot.grade_code or "", "default"),
                "isFrozen": snapshot.is_frozen,
                "groupName": group_name,
                "groupSort": group_sort,
                "rankNo": snapshot.rank_no,
                "groupRank": None,
            }
        )

    buckets: dict[str, list[dict]] = {}
    for item in items:
        buckets.setdefault(item["groupName"], []).append(item)
    for group_rows in buckets.values():
        group_rows.sort(key=lambda r: (-(r["wFinal"] or 0), r["empNo"]))
        previous_score = None
        previous_rank = 0
        for index, row in enumerate(group_rows, start=1):
            if row["isFrozen"]:
                row["groupRank"] = None
                continue
            score = round(row["wFinal"] or 0, 4)
            if previous_score is not None and score == previous_score:
                row["groupRank"] = previous_rank
            else:
                row["groupRank"] = index
                previous_rank = index
                previous_score = score
        for row in group_rows:
            row["groupTotal"] = len([r for r in group_rows if not r["isFrozen"]])

    items.sort(key=lambda r: (r["groupSort"], r["groupRank"] is None, r["groupRank"] or 0))
    return items


@router.get("/ranking", summary="公开榜单，姓名打码")
def public_ranking(db: Session = Depends(get_db)):
    period = _published_period(db)
    if not period:
        return ok({"period": None, "groups": [], "updatedAt": None})

    items = _build_rows(db, period)
    buckets: dict[str, list[dict]] = {}
    for item in items:
        buckets.setdefault(item["groupName"], []).append(item)

    groups = []
    for name, rows in buckets.items():
        groups.append(
            {
                "groupName": name,
                "total": rows[0].get("groupTotal", len(rows)),
                "rows": [
                    {
                        "groupRank": r["groupRank"],
                        "maskedName": r["maskedName"],
                        "wFinal": r["wFinal"],
                        "gradeCode": r["gradeCode"],
                        "gradeColor": r["gradeColor"],
                    }
                    for r in rows
                ],
            }
        )

    return ok(
        {
            "period": {"code": period.code, "year": period.year, "month": period.month},
            "groups": groups,
            "publishedAt": period.published_at,
        }
    )


@router.get("/lookup", summary="按姓名或工号查询本人位置")
def public_lookup(
    request: Request,
    keyword: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
):
    client = request.client.host if request.client else "unknown"
    current = now().timestamp()
    hits = [t for t in _lookup_hits.get(client, []) if current - t < LOOKUP_WINDOW]
    if len(hits) >= LOOKUP_LIMIT:
        raise NotFoundError("查询过于频繁，请稍后再试")
    hits.append(current)
    _lookup_hits[client] = hits

    period = _published_period(db)
    if not period:
        raise NotFoundError("本期结果尚未发布")

    text = keyword.strip()
    employee = db.scalar(
        select(Employee).where(
            Employee.deleted_at.is_(None),
            or_(Employee.name == text, func.lower(Employee.emp_no) == text.lower()),
        )
    )
    if not employee:
        raise NotFoundError("没有找到这个姓名或工号，请确认后重试")

    items = _build_rows(db, period)
    mine = next((i for i in items if i["employeeId"] == employee.id), None)
    if not mine:
        raise NotFoundError("你本期没有参与评价，暂无排名")

    same_group = [i for i in items if i["groupName"] == mine["groupName"] and not i["isFrozen"]]
    better = len([i for i in same_group if (i["wFinal"] or 0) > (mine["wFinal"] or 0)])

    return ok(
        {
            "name": employee.name,
            "empNo": employee.emp_no,
            "groupName": mine["groupName"],
            "groupRank": mine["groupRank"],
            "groupTotal": mine.get("groupTotal", len(same_group)),
            "wFinal": mine["wFinal"],
            "gradeCode": mine["gradeCode"],
            "gradeColor": mine["gradeColor"],
            "isFrozen": mine["isFrozen"],
            "aheadOf": len(same_group) - better - 1,
            "periodCode": period.code,
        }
    )
