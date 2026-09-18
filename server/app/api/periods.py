from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import ErrorCode, PeriodStatus, SubmissionStatus
from app.core.deps import CurrentUser, get_current_user, require_admin
from app.core.errors import BizError, StateConflictError
from app.core.response import ok, page
from app.db.session import get_db
from app.models import EvalPeriod, EvalSubmission, SysUser
from app.schemas.period import PeriodCreate, PeriodUpdate
from app.services import period_service
from app.utils.pagination import PageParams, page_params

router = APIRouter(prefix="/periods", tags=["评价周期"])

STATUS_LABELS = {
    PeriodStatus.DRAFT: "草稿",
    PeriodStatus.OPEN: "进行中",
    PeriodStatus.CLOSED: "已截止",
    PeriodStatus.COMPUTED: "已跑批",
    PeriodStatus.PUBLISHED: "已发布",
    PeriodStatus.ARCHIVED: "已归档",
}


def _serialize_many(db: Session, periods: list[EvalPeriod]) -> list[dict]:
    if not periods:
        return []
    period_ids = [p.id for p in periods]
    counts: dict[int, dict[str, int]] = {}
    for period_id, status, count in db.execute(
        select(EvalSubmission.period_id, EvalSubmission.status, func.count())
        .where(EvalSubmission.period_id.in_(period_ids))
        .group_by(EvalSubmission.period_id, EvalSubmission.status)
    ).all():
        counts.setdefault(period_id, {})[status] = count

    creator_ids = {p.created_by for p in periods if p.created_by}
    creators = (
        dict(db.execute(select(SysUser.id, SysUser.display_name).where(SysUser.id.in_(creator_ids))).all())
        if creator_ids
        else {}
    )

    items = []
    for period in periods:
        stat = counts.get(period.id, {})
        total = sum(stat.values())
        done = stat.get(SubmissionStatus.SUBMITTED, 0) + stat.get(SubmissionStatus.UNKNOWN, 0)
        items.append(
            {
                "id": period.id,
                "code": period.code,
                "year": period.year,
                "month": period.month,
                "status": period.status,
                "statusLabel": STATUS_LABELS.get(period.status, period.status),
                "openAt": period.open_at,
                "closeAt": period.close_at,
                "publishedAt": period.published_at,
                "configId": period.config_id,
                "createdBy": period.created_by,
                "createdByName": creators.get(period.created_by),
                "createdAt": period.created_at,
                "taskTotal": total,
                "taskDone": done,
                "taskRate": round(done / total, 4) if total else 0.0,
            }
        )
    return items


def _serialize(db: Session, period: EvalPeriod) -> dict:
    return _serialize_many(db, [period])[0]


@router.get("", summary="评价周期列表")
def list_periods(params: PageParams = Depends(page_params), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(EvalPeriod)) or 0
    rows = db.scalars(
        select(EvalPeriod).order_by(EvalPeriod.code.desc()).offset(params.offset).limit(params.limit)
    ).all()
    return page(_serialize_many(db, list(rows)), total, params.current, params.page_size)


@router.get("/current", summary="当前周期")
def current_period(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    period = db.scalar(select(EvalPeriod).where(EvalPeriod.status == PeriodStatus.OPEN))
    if not period:
        period = db.scalar(select(EvalPeriod).order_by(EvalPeriod.code.desc()))
    return ok(_serialize(db, period) if period else None)


@router.post("", summary="新建评价周期")
def create_period(payload: PeriodCreate, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    if db.scalar(select(EvalPeriod).where(EvalPeriod.code == payload.code)):
        raise BizError(f"周期 {payload.code} 已存在", ErrorCode.DUPLICATE_PERIOD)
    year, month = payload.code.split("-")
    period = EvalPeriod(
        code=payload.code,
        year=int(year),
        month=int(month),
        status=PeriodStatus.DRAFT,
        open_at=payload.openAt,
        close_at=payload.closeAt,
        created_by=admin.id,
    )
    db.add(period)
    db.flush()
    write_audit(db, admin, "PERIOD_CREATE", "eval_period", period.id, f"新建周期 {period.code}", period_id=period.id)
    db.commit()
    return ok(_serialize(db, period))


@router.put("/{period_id}", summary="修改周期时间")
def update_period(period_id: int, payload: PeriodUpdate, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    if period.status in (PeriodStatus.PUBLISHED, PeriodStatus.ARCHIVED):
        raise StateConflictError("已发布的周期不可修改")
    before = {"openAt": str(period.open_at), "closeAt": str(period.close_at)}
    if payload.openAt is not None:
        period.open_at = payload.openAt
    if payload.closeAt is not None:
        period.close_at = payload.closeAt
    write_audit(
        db, admin, "PERIOD_UPDATE", "eval_period", period.id, f"调整周期 {period.code} 的时间",
        before=before, after={"openAt": str(period.open_at), "closeAt": str(period.close_at)}, period_id=period.id,
    )
    db.commit()
    return ok(_serialize(db, period))


@router.post("/{period_id}/open", summary="开启周期并生成待评任务")
def open_period(period_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    result = period_service.open_period(db, period)
    write_audit(
        db, admin, "PERIOD_OPEN", "eval_period", period.id,
        f"开启周期 {period.code}，生成 {result['taskCount']} 条待评任务", after=result, period_id=period.id,
    )
    db.commit()
    return ok({**result, "period": _serialize(db, period)})


@router.post("/{period_id}/sync-tasks", summary="补齐待评任务")
def sync_tasks(period_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    if period.status != PeriodStatus.OPEN:
        raise StateConflictError("只有进行中的周期可以补齐任务")
    result = period_service.materialize_tasks(db, period)
    write_audit(
        db, admin, "PERIOD_SYNC_TASKS", "eval_period", period.id,
        f"周期 {period.code} 补齐 {result['taskCount']} 条任务", after=result, period_id=period.id,
    )
    db.commit()
    return ok(result)


@router.post("/{period_id}/close", summary="截止周期")
def close_period(period_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    result = period_service.close_period(db, period)
    write_audit(
        db, admin, "PERIOD_CLOSE", "eval_period", period.id,
        f"截止周期 {period.code}，{result['expiredCount']} 条未提交任务失效", after=result, period_id=period.id,
    )
    db.commit()
    return ok({**result, "period": _serialize(db, period)})


@router.post("/{period_id}/reopen", summary="重新开启周期")
def reopen_period(period_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    if period.status != PeriodStatus.CLOSED:
        raise StateConflictError("只有已截止且未发布的周期可以重新开启")
    rows = db.scalars(
        select(EvalSubmission).where(
            EvalSubmission.period_id == period.id, EvalSubmission.status == SubmissionStatus.EXPIRED
        )
    ).all()
    for row in rows:
        row.status = SubmissionStatus.DRAFT if row.raw_score is not None else SubmissionStatus.PENDING
    period.status = PeriodStatus.OPEN
    write_audit(
        db, admin, "PERIOD_REOPEN", "eval_period", period.id,
        f"重新开启周期 {period.code}，恢复 {len(rows)} 条任务", period_id=period.id,
    )
    db.commit()
    return ok({"restoredCount": len(rows), "period": _serialize(db, period)})


@router.get("/{period_id}/progress", summary="周期提交进度")
def progress(period_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    period = period_service.get_period_or_404(db, period_id)
    return ok({**period_service.period_progress(db, period), "period": _serialize(db, period)})
