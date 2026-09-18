import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import PeriodStatus
from app.core.deps import CurrentUser, require_admin
from app.core.errors import NotFoundError, StateConflictError
from app.core.response import ok, page
from app.db.base import now
from app.db.session import get_db
from app.models import EvalPeriod, SysUser, WeightAlert, WeightRun, WeightSnapshot
from app.services import period_service, weight_service
from app.utils.pagination import PageParams, page_params

router = APIRouter(prefix="/batch", tags=["跑批计算"])


@router.post("/run", summary="执行跑批计算")
def run_batch(
    periodId: int,
    runType: str = Query("draft"),
    dryRun: bool = Query(False),
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    period = period_service.get_period_or_404(db, periodId)
    result = weight_service.run_batch(db, period, admin.id, runType, dryRun)
    if not dryRun:
        write_audit(
            db, admin, "BATCH_RUN", "weight_run", result["runId"],
            f"周期 {period.code} 第 {result['runNo']} 次跑批，产出 {len(result['preview'])} 条快照",
            after={"stats": result["stats"]}, period_id=period.id,
        )
    db.commit()
    return ok(result)


@router.get("/runs", summary="跑批记录列表")
def list_runs(periodId: int | None = None, params: PageParams = Depends(page_params), admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    stmt = select(WeightRun)
    count_stmt = select(func.count()).select_from(WeightRun)
    if periodId:
        stmt = stmt.where(WeightRun.period_id == periodId)
        count_stmt = count_stmt.where(WeightRun.period_id == periodId)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.order_by(WeightRun.id.desc()).offset(params.offset).limit(params.limit)).all()
    periods = {p.id: p.code for p in db.scalars(select(EvalPeriod))}
    users = {u.id: u.display_name for u in db.scalars(select(SysUser))}
    items = [
        {
            "id": r.id,
            "periodId": r.period_id,
            "periodCode": periods.get(r.period_id),
            "runNo": r.run_no,
            "runType": r.run_type,
            "status": r.status,
            "startedAt": r.started_at,
            "finishedAt": r.finished_at,
            "durationMs": r.duration_ms,
            "triggeredByName": users.get(r.triggered_by),
            "isPublished": r.is_published,
            "snapshotCount": db.scalar(
                select(func.count()).select_from(WeightSnapshot).where(WeightSnapshot.run_id == r.id)
            ),
            "alertCount": db.scalar(
                select(func.count()).select_from(WeightAlert).where(WeightAlert.run_id == r.id)
            ),
        }
        for r in rows
    ]
    return page(items, total, params.current, params.page_size)


@router.get("/runs/{run_id}", summary="跑批详情与统计")
def run_detail(run_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    run = db.get(WeightRun, run_id)
    if not run:
        raise NotFoundError("跑批记录不存在")
    stats = json.loads(run.stats_json) if run.stats_json else {}
    users = {u.id: u.display_name for u in db.scalars(select(SysUser))}
    for item in stats.get("raterStats", []):
        item["raterName"] = users.get(item.get("raterUserId"), "")
    return ok(
        {
            "id": run.id,
            "periodId": run.period_id,
            "runNo": run.run_no,
            "status": run.status,
            "durationMs": run.duration_ms,
            "isPublished": run.is_published,
            "stats": stats,
        }
    )


@router.get("/runs/{run_id}/alerts", summary="跑批告警")
def run_alerts(run_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(WeightAlert).where(WeightAlert.run_id == run_id).order_by(WeightAlert.level)).all()
    return ok(
        [
            {"id": a.id, "level": a.level, "code": a.code, "message": a.message, "employeeId": a.employee_id}
            for a in rows
        ]
    )


@router.post("/runs/{run_id}/publish", summary="发布跑批结果")
def publish_run(run_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    run = db.get(WeightRun, run_id)
    if not run:
        raise NotFoundError("跑批记录不存在")
    period = period_service.get_period_or_404(db, run.period_id)
    for other in db.scalars(
        select(WeightRun).where(
            WeightRun.period_id == period.id, WeightRun.is_published, WeightRun.id != run.id
        )
    ):
        other.is_published = False
        for snapshot in db.scalars(select(WeightSnapshot).where(WeightSnapshot.run_id == other.id)):
            snapshot.is_published = False
    count = 0
    for snapshot in db.scalars(select(WeightSnapshot).where(WeightSnapshot.run_id == run.id)):
        snapshot.is_published = True
        count += 1
    if count == 0:
        raise StateConflictError("这次跑批没有产出快照，无法发布")
    run.is_published = True
    period.status = PeriodStatus.PUBLISHED
    period.published_at = now()
    write_audit(
        db, admin, "BATCH_PUBLISH", "weight_run", run.id,
        f"发布周期 {period.code} 第 {run.run_no} 次跑批结果，{count} 条", period_id=period.id,
    )
    db.commit()
    return ok({"publishedCount": count, "periodStatus": period.status})
