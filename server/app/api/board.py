from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user
from app.core.response import ok
from app.db.session import get_db
from app.models import ConfigGradeBand, Employee, EmployeeTag, EvalPeriod, Tag, WeightSnapshot

router = APIRouter(prefix="/board", tags=["排名榜"])


def _published_period(db: Session) -> EvalPeriod | None:
    period_id = db.scalar(
        select(WeightSnapshot.period_id)
        .where(WeightSnapshot.is_published)
        .order_by(WeightSnapshot.period_id.desc())
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


@router.get("/ranking", summary="匿名排名榜，登录后可见")
def ranking(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    period = _published_period(db)
    if not period:
        return ok({"period": None, "groups": [], "mine": None})

    rows = db.execute(
        select(WeightSnapshot, Employee)
        .join(Employee, Employee.id == WeightSnapshot.employee_id)
        .where(WeightSnapshot.period_id == period.id, WeightSnapshot.is_published)
    ).all()
    groups = _group_map(db, [e.id for _, e in rows])
    colors = _grade_colors(db, period.config_id)

    my_employee = db.scalar(select(Employee).where(Employee.user_id == user.id))
    my_employee_id = my_employee.id if my_employee else None

    items = []
    for snapshot, employee in rows:
        group_name, group_sort = groups.get(employee.id, ("未分组", 9999))
        items.append(
            {
                "employeeId": employee.id,
                "empNo": employee.emp_no,
                "name": employee.name,
                "wFinal": snapshot.w_final,
                "gradeCode": snapshot.grade_code,
                "gradeColor": colors.get(snapshot.grade_code or "", "default"),
                "isFrozen": snapshot.is_frozen,
                "groupName": group_name,
                "groupSort": group_sort,
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
        active = len([r for r in group_rows if not r["isFrozen"]])
        for row in group_rows:
            row["groupTotal"] = active

    mine = None
    result_groups = []
    for name, group_rows in sorted(buckets.items(), key=lambda kv: kv[1][0]["groupSort"]):
        serialized = []
        for seat, row in enumerate(group_rows, start=1):
            is_me = row["employeeId"] == my_employee_id
            if is_me:
                ahead = len([r for r in group_rows if not r["isFrozen"] and (r["wFinal"] or 0) > (row["wFinal"] or 0)])
                mine = {
                    "name": row["name"],
                    "empNo": row["empNo"],
                    "groupName": row["groupName"],
                    "groupRank": row["groupRank"],
                    "groupTotal": row["groupTotal"],
                    "wFinal": row["wFinal"],
                    "gradeCode": row["gradeCode"],
                    "gradeColor": row["gradeColor"],
                    "aheadOf": row["groupTotal"] - ahead - 1,
                }
            serialized.append(
                {
                    "seat": seat,
                    "groupRank": row["groupRank"],
                    "wFinal": row["wFinal"],
                    "gradeCode": row["gradeCode"],
                    "gradeColor": row["gradeColor"],
                    "isMe": is_me,
                }
            )
        result_groups.append(
            {"groupName": name, "total": group_rows[0]["groupTotal"], "rows": serialized}
        )

    return ok(
        {
            "period": {"code": period.code, "year": period.year, "month": period.month},
            "groups": result_groups,
            "mine": mine,
        }
    )
