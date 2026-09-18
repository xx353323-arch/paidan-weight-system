import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.constants import RoleCode
from app.core.deps import CurrentUser, get_current_user, require_admin
from app.core.errors import NotFoundError, PermissionError_
from app.core.response import ok, page
from app.db.session import get_db
from app.models import (
    ConfigRoleWeight,
    Employee,
    EmployeeTag,
    EvalPeriod,
    SnapshotAdjustmentLink,
    SysUser,
    Tag,
    WeightAdjustment,
    WeightRoleBlock,
    WeightSnapshot,
)
from app.utils.pagination import PageParams, page_params

router = APIRouter(prefix="/weights", tags=["权重结果"])

COVERAGE_LABELS = {
    "HIGH": "覆盖充分",
    "MEDIUM": "覆盖较好",
    "LOW": "覆盖不足",
    "THIN": "证据很薄",
    "NONE": "无人评价",
}


def _can_view(user: CurrentUser) -> bool:
    return user.is_admin or user.is_rater


UNGROUPED_NAME = "未分组"


def _tag_map(db: Session, employee_ids: list[int]) -> dict[int, list[dict]]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EmployeeTag.employee_id, Tag.id, Tag.name, Tag.color, Tag.is_group, Tag.sort_order)
        .join(Tag, Tag.id == EmployeeTag.tag_id)
        .where(EmployeeTag.employee_id.in_(employee_ids))
        .order_by(Tag.sort_order, Tag.id)
    ).all()
    result: dict[int, list[dict]] = {}
    for employee_id, tag_id, name, color, is_group, sort_order in rows:
        result.setdefault(employee_id, []).append(
            {"id": tag_id, "name": name, "color": color, "isGroup": is_group, "sortOrder": sort_order}
        )
    return result


def _group_of(tags: list[dict]) -> tuple[str, int]:
    for tag in tags:
        if tag.get("isGroup"):
            return tag["name"], tag.get("sortOrder", 0)
    return UNGROUPED_NAME, 9999


def _assign_group_ranks(items: list[dict]) -> None:
    buckets: dict[str, list[dict]] = {}
    for item in items:
        buckets.setdefault(item["groupName"], []).append(item)
    for rows in buckets.values():
        rows.sort(key=lambda r: (-(r["wFinal"] or 0), r["rankNo"] or 9999, r["empNo"]))
        previous_score = None
        previous_rank = 0
        for index, row in enumerate(rows, start=1):
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
        active = [r for r in rows if not r["isFrozen"]]
        for row in rows:
            row["groupTotal"] = len(active)


def _resolve_period(db: Session, period_id: int | None, published_only: bool) -> EvalPeriod | None:
    if period_id:
        return db.get(EvalPeriod, period_id)
    stmt = select(WeightSnapshot.period_id).order_by(WeightSnapshot.period_id.desc())
    if published_only:
        stmt = stmt.where(WeightSnapshot.is_published)
    latest = db.scalar(stmt)
    return db.get(EvalPeriod, latest) if latest else None


@router.get("", summary="权重排行榜")
def ranking(
    periodId: int | None = None,
    keyword: str | None = None,
    grade: str | None = None,
    tagIds: str | None = None,
    includeDraft: bool = Query(False),
    params: PageParams = Depends(page_params),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _can_view(user):
        raise PermissionError_("没有查看派单参考的权限")

    published_only = not (includeDraft and user.is_admin)
    period = _resolve_period(db, periodId, published_only)
    if not period:
        return page([], 0, params.current, params.page_size)

    stmt = (
        select(WeightSnapshot, Employee)
        .join(Employee, Employee.id == WeightSnapshot.employee_id)
        .where(WeightSnapshot.period_id == period.id)
    )
    if published_only:
        stmt = stmt.where(WeightSnapshot.is_published)
    else:
        latest_run = db.scalar(
            select(func.max(WeightSnapshot.run_id)).where(WeightSnapshot.period_id == period.id)
        )
        stmt = stmt.where(WeightSnapshot.run_id == latest_run)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(or_(Employee.name.like(like), Employee.emp_no.like(like)))
    if grade:
        stmt = stmt.where(WeightSnapshot.grade_code == grade)

    rows = db.execute(stmt).all()

    tag_ids = [int(t) for t in (tagIds or "").split(",") if t.strip().isdigit()]
    tags = _tag_map(db, [e.id for _, e in rows])
    if tag_ids:
        rows = [(s, e) for s, e in rows if any(t["id"] in tag_ids for t in tags.get(e.id, []))]

    rows.sort(key=lambda pair: (pair[0].rank_no is None, pair[0].rank_no or 0, -pair[0].w_final))
    total = len(rows)
    sliced = rows[params.offset : params.offset + params.limit]

    items = []
    for snapshot, employee in sliced:
        delta = None
        if snapshot.w_prev is not None:
            delta = round(snapshot.w_final - snapshot.w_prev, 2)
        items.append(
            {
                "employeeId": employee.id,
                "empNo": employee.emp_no,
                "name": employee.name,
                "rankNo": snapshot.rank_no,
                "wFinal": snapshot.w_final,
                "wPrev": snapshot.w_prev,
                "delta": delta,
                "gradeCode": snapshot.grade_code,
                "scoreBand": snapshot.score_band,
                "coverageScore": snapshot.coverage_score,
                "coverageLevel": snapshot.coverage_level,
                "coverageLabel": COVERAGE_LABELS.get(snapshot.coverage_level, ""),
                "raterCount": snapshot.rater_count,
                "effectiveN": snapshot.effective_n,
                "missingRoles": json.loads(snapshot.missing_roles) if snapshot.missing_roles else [],
                "isFrozen": snapshot.is_frozen,
                "isCarryForward": snapshot.is_carry_forward,
                "floorApplied": snapshot.floor_applied,
                "adjustSummary": snapshot.adjust_summary,
                "employmentStatus": employee.employment_status,
                "inDispatchPool": employee.in_dispatch_pool,
                "tags": tags.get(employee.id, []),
                "groupName": _group_of(tags.get(employee.id, []))[0],
                "groupSort": _group_of(tags.get(employee.id, []))[1],
                "groupRank": None,
                "groupTotal": 0,
            }
        )

    _assign_group_ranks(items)
    items.sort(key=lambda r: (r["groupSort"], r["groupRank"] is None, r["groupRank"] or 0))

    return page(items, total, params.current, params.page_size)


@router.get("/periods", summary="有结果的周期列表")
def result_periods(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can_view(user):
        raise PermissionError_()
    period_ids = list(db.scalars(select(WeightSnapshot.period_id).distinct()))
    rows = db.scalars(select(EvalPeriod).where(EvalPeriod.id.in_(period_ids or [0])).order_by(EvalPeriod.code.desc())).all()
    published = set(
        db.scalars(select(WeightSnapshot.period_id).where(WeightSnapshot.is_published).distinct())
    )
    return ok(
        [
            {"value": p.id, "label": f"{p.year}年{p.month}月", "code": p.code, "isPublished": p.id in published}
            for p in rows
        ]
    )


@router.get("/{employee_id}", summary="某人的得分明细")
def detail(
    employee_id: int,
    periodId: int | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _can_view(user):
        raise PermissionError_()
    period = _resolve_period(db, periodId, not user.is_admin)
    if not period:
        raise NotFoundError("还没有可查看的评价结果")

    stmt = select(WeightSnapshot).where(
        WeightSnapshot.period_id == period.id, WeightSnapshot.employee_id == employee_id
    )
    if not user.is_admin:
        stmt = stmt.where(WeightSnapshot.is_published)
    snapshot = db.scalar(stmt.order_by(WeightSnapshot.run_id.desc()))
    if not snapshot:
        raise NotFoundError("没有找到该员工本期的评价结果")

    employee = db.get(Employee, employee_id)
    role_labels = {
        r.role_code: r.label
        for r in db.scalars(select(ConfigRoleWeight).where(ConfigRoleWeight.config_id == period.config_id))
    }
    blocks = db.scalars(select(WeightRoleBlock).where(WeightRoleBlock.snapshot_id == snapshot.id)).all()
    details = json.loads(snapshot.detail_json) if snapshot.detail_json else []

    adjustments = []
    for link in db.scalars(select(SnapshotAdjustmentLink).where(SnapshotAdjustmentLink.snapshot_id == snapshot.id)):
        record = db.get(WeightAdjustment, link.adjustment_id)
        creator = db.get(SysUser, record.created_by) if record and record.created_by else None
        adjustments.append(
            {
                "adjustType": link.adjust_type,
                "valueUsed": link.value_used,
                "valueBefore": link.value_before,
                "valueAfter": link.value_after,
                "wasEffective": link.was_effective,
                "skipReason": link.skip_reason,
                "reason": record.reason if record else "",
                "createdByName": creator.display_name if creator else None,
            }
        )

    rater_summary = {}
    for item in details:
        role = item.get("roleCode")
        rater_summary.setdefault(role, {"count": 0, "familiaritySum": 0.0})
        rater_summary[role]["count"] += 1
        rater_summary[role]["familiaritySum"] += item.get("familiarityWeight", 0)

    return ok(
        {
            "employee": {
                "id": employee.id,
                "empNo": employee.emp_no,
                "name": employee.name,
                "employmentStatus": employee.employment_status,
                "tags": _tag_map(db, [employee.id]).get(employee.id, []),
            },
            "period": {"id": period.id, "code": period.code, "status": period.status},
            "snapshot": {
                "wFinal": snapshot.w_final,
                "wRaw": snapshot.w_raw,
                "wPrev": snapshot.w_prev,
                "wSmooth": snapshot.w_smooth,
                "wAdjusted": snapshot.w_adjusted,
                "smoothAlpha": snapshot.smooth_alpha,
                "sSubj": snapshot.s_subj,
                "gradeCode": snapshot.grade_code,
                "rankNo": snapshot.rank_no,
                "rankPct": snapshot.rank_pct,
                "coverageScore": snapshot.coverage_score,
                "coverageLevel": snapshot.coverage_level,
                "coverageLabel": COVERAGE_LABELS.get(snapshot.coverage_level, ""),
                "gamma": snapshot.gamma,
                "raterCount": snapshot.rater_count,
                "effectiveN": snapshot.effective_n,
                "scoreBand": snapshot.score_band,
                "missingRoles": json.loads(snapshot.missing_roles) if snapshot.missing_roles else [],
                "coveredRoles": json.loads(snapshot.covered_roles) if snapshot.covered_roles else [],
                "isFrozen": snapshot.is_frozen,
                "isCarryForward": snapshot.is_carry_forward,
                "floorApplied": snapshot.floor_applied,
                "adjustSummary": snapshot.adjust_summary,
                "isPublished": snapshot.is_published,
            },
            "blocks": [
                {
                    "roleCode": b.role_code,
                    "roleLabel": role_labels.get(b.role_code, b.role_code),
                    "blockScore": b.block_score,
                    "nominalWeight": b.nominal_weight,
                    "credibility": b.credibility,
                    "appliedWeight": b.applied_weight,
                    "raterCount": b.rater_count,
                    "familiaritySum": b.familiarity_sum,
                    "effectiveN": b.effective_n,
                    "wasMissing": b.was_missing,
                }
                for b in blocks
            ],
            "raterSummary": [
                {"roleCode": k, "roleLabel": role_labels.get(k, k), **v} for k, v in rater_summary.items()
            ],
            "raterDetails": details if user.is_admin else [],
            "adjustments": adjustments,
        }
    )
