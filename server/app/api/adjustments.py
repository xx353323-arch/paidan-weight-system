from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import AdjustStatus, AdjustType
from app.core.deps import CurrentUser, require_admin
from app.core.errors import BizError, NotFoundError, StateConflictError
from app.core.response import ok, page
from app.db.base import now
from app.db.session import get_db
from app.engine.adjust import apply_adjustments
from app.engine.types import AdjustmentInput
from app.models import AlgoConfig, ConfigGradeBand, Employee, EvalPeriod, SysUser, WeightAdjustment
from app.schemas.adjustment import AdjustmentCreate, AdjustmentPreview, AdjustmentRevoke
from app.services import period_service, weight_service
from app.utils.pagination import PageParams, page_params

router = APIRouter(prefix="/adjustments", tags=["人工调权"])

ADJUST_TYPE_LABELS = {
    AdjustType.FREEZE: "冻结",
    AdjustType.OVERRIDE: "绝对覆盖",
    AdjustType.MULTIPLIER: "乘数",
    AdjustType.DELTA: "加减分",
}

ADJUST_STATUS_LABELS = {
    AdjustStatus.ACTIVE: "生效中",
    AdjustStatus.REVOKED: "已撤销",
    AdjustStatus.EXPIRED: "已过期",
}

SKIP_REASON_LABELS = {
    "FREEZE_TAKES_PRECEDENCE": "被冻结记录覆盖",
    "OVERRIDE_TAKES_PRECEDENCE": "被绝对覆盖记录覆盖",
}

PRIORITY_TYPES = (AdjustType.MULTIPLIER, AdjustType.DELTA)


def _num(value: float | None) -> str:
    if value is None:
        return ""
    if float(value).is_integer():
        return str(int(value))
    return str(round(float(value), 4))


def _value_label(adjust_type: str, value: float | None) -> str:
    if adjust_type == AdjustType.FREEZE:
        return "冻结"
    if adjust_type == AdjustType.MULTIPLIER:
        return f"×{_num(value)}"
    if adjust_type == AdjustType.OVERRIDE:
        return f"={_num(value)} 分"
    if adjust_type == AdjustType.DELTA:
        text = _num(value)
        return f"+{text} 分" if (value or 0) >= 0 else f"{text} 分"
    return _num(value)


def _validate_value(adjust_type: str, value: float | None) -> None:
    if adjust_type not in ADJUST_TYPE_LABELS:
        raise BizError("调整类型只能是冻结、绝对覆盖、乘数或加减分")
    if adjust_type == AdjustType.FREEZE:
        if value is not None:
            raise BizError("冻结不需要填写调整值")
        return
    if value is None:
        raise BizError("请填写调整值")
    if adjust_type == AdjustType.MULTIPLIER and not 0.1 <= value <= 2.0:
        raise BizError("乘数必须在 0.1 到 2.0 之间")
    if adjust_type == AdjustType.DELTA and not -30 <= value <= 30:
        raise BizError("加减分必须在 -30 到 30 之间")
    if adjust_type == AdjustType.OVERRIDE and not 0 <= value <= 100:
        raise BizError("绝对覆盖分必须在 0 到 100 之间")


def _period_codes(db: Session) -> dict[int, str]:
    return {row.id: row.code for row in db.scalars(select(EvalPeriod))}


def _overlaps(a_from: str, a_to: str | None, b_from: str, b_to: str | None) -> bool:
    if a_to is not None and b_from > a_to:
        return False
    if b_to is not None and a_from > b_to:
        return False
    return True


def _serialize(rows: list[WeightAdjustment], db: Session) -> list[dict]:
    if not rows:
        return []
    employee_ids = {r.employee_id for r in rows}
    employees = {
        e.id: e for e in db.scalars(select(Employee).where(Employee.id.in_(employee_ids)))
    }
    user_ids = {r.created_by for r in rows if r.created_by} | {r.revoked_by for r in rows if r.revoked_by}
    users = (
        dict(db.execute(select(SysUser.id, SysUser.display_name).where(SysUser.id.in_(user_ids))).all())
        if user_ids
        else {}
    )
    codes = _period_codes(db)

    items = []
    for row in rows:
        employee = employees.get(row.employee_id)
        items.append(
            {
                "id": row.id,
                "employeeId": row.employee_id,
                "employeeName": employee.name if employee else "已删除员工",
                "empNo": employee.emp_no if employee else "",
                "adjustType": row.adjust_type,
                "adjustTypeLabel": ADJUST_TYPE_LABELS.get(row.adjust_type, row.adjust_type),
                "value": row.value,
                "valueLabel": _value_label(row.adjust_type, row.value),
                "reason": row.reason,
                "effectiveFromPeriodId": row.effective_from_period_id,
                "effectiveToPeriodId": row.effective_to_period_id,
                "effectiveFromCode": codes.get(row.effective_from_period_id),
                "effectiveToCode": codes.get(row.effective_to_period_id) if row.effective_to_period_id else None,
                "status": row.status,
                "statusLabel": ADJUST_STATUS_LABELS.get(row.status, row.status),
                "createdByName": users.get(row.created_by),
                "createdAt": row.created_at,
                "revokedByName": users.get(row.revoked_by),
                "revokedAt": row.revoked_at,
                "revokeReason": row.revoke_reason,
            }
        )
    return items


def _conflict_warnings(
    db: Session, employee_id: int, adjust_type: str, from_code: str, to_code: str | None
) -> list[str]:
    codes = _period_codes(db)
    rows = db.scalars(
        select(WeightAdjustment)
        .where(
            WeightAdjustment.employee_id == employee_id,
            WeightAdjustment.status == AdjustStatus.ACTIVE,
        )
        .order_by(WeightAdjustment.created_at, WeightAdjustment.id)
    ).all()
    overlapped = [
        row
        for row in rows
        if _overlaps(
            from_code,
            to_code,
            codes.get(row.effective_from_period_id, ""),
            codes.get(row.effective_to_period_id) if row.effective_to_period_id else None,
        )
    ]
    if not overlapped:
        return []

    freezes = [r for r in overlapped if r.adjust_type == AdjustType.FREEZE]
    overrides = [r for r in overlapped if r.adjust_type == AdjustType.OVERRIDE]
    scalers = [r for r in overlapped if r.adjust_type in PRIORITY_TYPES]

    warnings = []
    if freezes and adjust_type != AdjustType.FREEZE:
        warnings.append("该员工同期已有冻结记录，冻结优先级最高，本次调整不会影响最终分")
    if adjust_type == AdjustType.FREEZE and (overrides or scalers):
        warnings.append(f"冻结优先级最高，同期已有的 {len(overrides) + len(scalers)} 条调整在跑批时全部失效")
    if adjust_type in PRIORITY_TYPES and overrides:
        latest = overrides[-1]
        warnings.append(
            f"该员工同期已有绝对覆盖调整（{_value_label(latest.adjust_type, latest.value)}），本次乘数与加减分不会生效"
        )
    if adjust_type == AdjustType.OVERRIDE and scalers:
        warnings.append(f"本次绝对覆盖会让同期已有的 {len(scalers)} 条乘数或加减分调整全部失效")
    if adjust_type == AdjustType.OVERRIDE and overrides:
        latest = overrides[-1]
        warnings.append(
            f"该员工同期已有绝对覆盖调整（{_value_label(latest.adjust_type, latest.value)}），跑批时以最后创建的一条为准"
        )
    return warnings


@router.get("", summary="调权记录列表")
def list_adjustments(
    employeeId: int | None = Query(None),
    status: str | None = Query(None),
    adjustType: str | None = Query(None),
    periodId: int | None = Query(None),
    params: PageParams = Depends(page_params),
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(WeightAdjustment)
    count_stmt = select(func.count()).select_from(WeightAdjustment)
    if employeeId:
        stmt = stmt.where(WeightAdjustment.employee_id == employeeId)
        count_stmt = count_stmt.where(WeightAdjustment.employee_id == employeeId)
    if status:
        stmt = stmt.where(WeightAdjustment.status == status)
        count_stmt = count_stmt.where(WeightAdjustment.status == status)
    if adjustType:
        stmt = stmt.where(WeightAdjustment.adjust_type == adjustType)
        count_stmt = count_stmt.where(WeightAdjustment.adjust_type == adjustType)
    if periodId:
        codes = _period_codes(db)
        target = codes.get(periodId)
        if not target:
            return page([], 0, params.current, params.page_size)
        started = [pid for pid, code in codes.items() if code <= target] or [0]
        not_ended = [pid for pid, code in codes.items() if code >= target] or [0]
        period_filter = (
            WeightAdjustment.effective_from_period_id.in_(started),
            or_(
                WeightAdjustment.effective_to_period_id.is_(None),
                WeightAdjustment.effective_to_period_id.in_(not_ended),
            ),
        )
        stmt = stmt.where(*period_filter)
        count_stmt = count_stmt.where(*period_filter)

    total = db.scalar(count_stmt) or 0
    rank = case((WeightAdjustment.status == AdjustStatus.ACTIVE, 0), else_=1)
    rows = db.scalars(
        stmt.order_by(rank, WeightAdjustment.created_at.desc(), WeightAdjustment.id.desc())
        .offset(params.offset)
        .limit(params.limit)
    ).all()
    return page(_serialize(list(rows), db), total, params.current, params.page_size)


@router.post("", summary="新建调权记录")
def create_adjustment(
    payload: AdjustmentCreate,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = db.get(Employee, payload.employeeId)
    if not employee or employee.deleted_at is not None:
        raise NotFoundError("员工不存在")
    reason = payload.reason.strip()
    if len(reason) < 10:
        raise BizError("调整原因至少填写 10 个字，便于以后追溯")
    _validate_value(payload.adjustType, payload.value)

    start = db.get(EvalPeriod, payload.effectiveFromPeriodId)
    if not start:
        raise NotFoundError("生效周期不存在")
    end = db.get(EvalPeriod, payload.effectiveToPeriodId) if payload.effectiveToPeriodId else None
    if payload.effectiveToPeriodId and not end:
        raise NotFoundError("失效周期不存在")
    if end and end.code < start.code:
        raise BizError("失效周期不能早于生效周期")

    warnings = _conflict_warnings(
        db, payload.employeeId, payload.adjustType, start.code, end.code if end else None
    )

    row = WeightAdjustment(
        employee_id=payload.employeeId,
        adjust_type=payload.adjustType,
        value=payload.value,
        reason=reason,
        effective_from_period_id=start.id,
        effective_to_period_id=end.id if end else None,
        status=AdjustStatus.ACTIVE,
        created_by=admin.id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        admin,
        "ADJUST_CREATE",
        "weight_adjustment",
        row.id,
        f"{employee.name} 新增{ADJUST_TYPE_LABELS.get(payload.adjustType, payload.adjustType)}调整"
        f" {_value_label(payload.adjustType, payload.value)}，自 {start.code} 起生效",
        after={
            "employeeId": payload.employeeId,
            "adjustType": payload.adjustType,
            "value": payload.value,
            "reason": reason,
            "effectiveFrom": start.code,
            "effectiveTo": end.code if end else None,
        },
        period_id=start.id,
    )
    db.commit()
    db.refresh(row)
    item = _serialize([row], db)[0]
    return ok({**item, "warnings": warnings})


@router.post("/preview", summary="调整效果预览")
def preview_adjustment(
    payload: AdjustmentPreview,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    period = period_service.get_period_or_404(db, payload.periodId)
    if not payload.adjustments:
        raise BizError("请至少填写一条待预览的调整")

    extra: dict[int, list[AdjustmentInput]] = {}
    for index, item in enumerate(payload.adjustments):
        employee = db.get(Employee, item.employeeId)
        if not employee or employee.deleted_at is not None:
            raise NotFoundError("员工不存在")
        _validate_value(item.adjustType, item.value)
        extra.setdefault(item.employeeId, []).append(
            AdjustmentInput(
                adjustment_id=-(index + 1),
                adjust_type=item.adjustType,
                value=item.value,
                reason="预览",
                created_at_order=1_000_000 + index,
            )
        )

    before = weight_service.run_batch(db, period, admin.id, "preview", True)
    after = weight_service.run_batch(db, period, admin.id, "preview", True, extra)
    db.rollback()

    employees = {e.id: e for e in db.scalars(select(Employee))}
    bands = db.scalars(
        select(ConfigGradeBand)
        .where(ConfigGradeBand.config_id == period.config_id)
        .order_by(ConfigGradeBand.sort_order)
    ).all()

    def rows(result: dict) -> list[dict]:
        items = []
        for row in result["preview"]:
            employee = employees.get(row["employeeId"])
            items.append(
                {
                    "employeeId": row["employeeId"],
                    "empNo": employee.emp_no if employee else "",
                    "name": employee.name if employee else "",
                    "rankNo": row["rankNo"],
                    "wFinal": round(row["wFinal"], 2),
                    "gradeCode": row["gradeCode"],
                    "isFrozen": row["isFrozen"],
                    "adjustSummary": row["adjustSummary"],
                }
            )
        return items

    def distribution(items: list[dict]) -> list[dict]:
        counts: dict[str, int] = {}
        for row in items:
            key = row["gradeCode"] or "UNKNOWN"
            counts[key] = counts.get(key, 0) + 1
        result = [{"code": b.code, "label": b.label, "count": counts.get(b.code, 0)} for b in bands]
        if counts.get("F"):
            result.append({"code": "F", "label": "已冻结", "count": counts["F"]})
        return result

    before_rows = rows(before)
    after_rows = rows(after)
    before_map = {row["employeeId"]: row for row in before_rows}

    changes = []
    for row in after_rows:
        origin = before_map.get(row["employeeId"])
        if not origin:
            continue
        same_rank = origin["rankNo"] == row["rankNo"]
        same_score = abs(origin["wFinal"] - row["wFinal"]) < 0.005
        if same_rank and same_score:
            continue
        rank_delta = None
        if origin["rankNo"] is not None and row["rankNo"] is not None:
            rank_delta = origin["rankNo"] - row["rankNo"]
        changes.append(
            {
                "employeeId": row["employeeId"],
                "name": row["name"],
                "empNo": row["empNo"],
                "rankBefore": origin["rankNo"],
                "rankAfter": row["rankNo"],
                "scoreBefore": origin["wFinal"],
                "scoreAfter": row["wFinal"],
                "scoreDelta": round(row["wFinal"] - origin["wFinal"], 2),
                "rankDelta": rank_delta,
                "gradeBefore": origin["gradeCode"],
                "gradeAfter": row["gradeCode"],
                "isTarget": row["employeeId"] in extra,
            }
        )
    changes.sort(key=lambda x: (not x["isTarget"], x["rankAfter"] is None, x["rankAfter"] or 0))

    return ok(
        {
            "periodId": period.id,
            "periodCode": period.code,
            "before": before_rows,
            "after": after_rows,
            "rankChanges": changes,
            "gradeDistributionBefore": distribution(before_rows),
            "gradeDistributionAfter": distribution(after_rows),
        }
    )


@router.get("/effective", summary="本期实际生效的调权清单")
def effective_adjustments(
    periodId: int | None = Query(None),
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    period = (
        db.get(EvalPeriod, periodId)
        if periodId
        else db.scalar(select(EvalPeriod).order_by(EvalPeriod.code.desc()))
    )
    if not period:
        raise NotFoundError("周期不存在")

    grouped = weight_service.collect_adjustments(db, period)
    config = db.get(AlgoConfig, period.config_id) if period.config_id else None
    params = weight_service.build_params(config) if config else None
    if params is None:
        raise StateConflictError("周期没有绑定算法配置，无法判断调整是否生效")

    flags: dict[int, tuple[bool, str | None]] = {}
    for items in grouped.values():
        _, _, traces, _ = apply_adjustments(0.0, items, params)
        for trace in traces:
            flags[trace.adjustment_id] = (trace.was_effective, trace.skip_reason)

    ids = [item.adjustment_id for items in grouped.values() for item in items]
    rows = db.scalars(select(WeightAdjustment).where(WeightAdjustment.id.in_(ids or [0]))).all()
    order = {adjustment_id: index for index, adjustment_id in enumerate(ids)}
    ordered = sorted(rows, key=lambda r: order.get(r.id, 0))

    items = []
    for item in _serialize(ordered, db):
        was_effective, skip_reason = flags.get(item["id"], (True, None))
        items.append(
            {
                **item,
                "wasEffective": was_effective,
                "skipReason": skip_reason,
                "skipReasonLabel": SKIP_REASON_LABELS.get(skip_reason or "", ""),
            }
        )
    return ok({"periodId": period.id, "periodCode": period.code, "items": items})


@router.post("/{adjustment_id}/revoke", summary="撤销调权记录")
def revoke_adjustment(
    adjustment_id: int,
    payload: AdjustmentRevoke,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.get(WeightAdjustment, adjustment_id)
    if not row:
        raise NotFoundError("调权记录不存在")
    if row.status != AdjustStatus.ACTIVE:
        raise StateConflictError("只有生效中的调权记录可以撤销")
    reason = payload.reason.strip()
    if len(reason) < 5:
        raise BizError("撤销原因至少填写 5 个字")

    employee = db.get(Employee, row.employee_id)
    row.status = AdjustStatus.REVOKED
    row.revoked_by = admin.id
    row.revoked_at = now()
    row.revoke_reason = reason
    write_audit(
        db,
        admin,
        "ADJUST_REVOKE",
        "weight_adjustment",
        row.id,
        f"撤销 {employee.name if employee else '未知员工'} 的"
        f"{ADJUST_TYPE_LABELS.get(row.adjust_type, row.adjust_type)}调整"
        f" {_value_label(row.adjust_type, row.value)}",
        after={"reason": reason},
        period_id=row.effective_from_period_id,
    )
    db.commit()
    db.refresh(row)
    return ok(_serialize([row], db)[0])
