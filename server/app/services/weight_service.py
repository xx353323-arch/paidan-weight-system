import json
from datetime import date, datetime


def tenure_months(hired_at: date | None, reference: date) -> int | None:
    if hired_at is None:
        return None
    return max(0, (reference.year - hired_at.year) * 12 + reference.month - hired_at.month)

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import ACTIVE_EMPLOYMENT, AdjustStatus, PeriodStatus, RunStatus, SubmissionStatus
from app.core.errors import StateConflictError
from app.db.base import now
from app.engine.pipeline import run_pipeline
from app.engine.types import (
    AdjustmentInput,
    AlgoParams,
    EmployeeContext,
    GradeBandConfig,
    ItemScoreInput,
    RoleWeightConfig,
    SubmissionInput,
)
from app.models import (
    AlgoConfig,
    ConfigGradeBand,
    ConfigRoleWeight,
    Employee,
    EvalItemScore,
    EvalPeriod,
    EvalSubmission,
    SnapshotAdjustmentLink,
    SysUser,
    WeightAdjustment,
    WeightAlert,
    WeightRoleBlock,
    WeightRun,
    WeightSnapshot,
)

ACTIVE_STATUS_VALUES = [s.value for s in ACTIVE_EMPLOYMENT]


def build_params(config: AlgoConfig) -> AlgoParams:
    try:
        alpha = tuple(json.loads(config.smooth_alpha_json))
    except (TypeError, ValueError):
        alpha = (1.0, 0.85, 0.70)
    return AlgoParams(
        score_center=config.score_center,
        score_scale=config.score_scale,
        score_clip_low=config.score_clip_low,
        score_clip_high=config.score_clip_high,
        z_min_n=config.z_min_n,
        z_shrink_k=config.z_shrink_k,
        z_sigma_floor=config.z_sigma_floor,
        z_blend_beta=config.z_blend_beta,
        abs_base=config.abs_base,
        abs_step=config.abs_step,
        pool_min_count=config.pool_min_count,
        coverage_full_threshold=config.coverage_full_threshold,
        require_lead_block=config.require_lead_block,
        objective_enabled=config.objective_enabled,
        subj_weight=config.subj_weight,
        obj_weight=config.obj_weight,
        smooth_alpha=alpha,
        newcomer_protect_periods=config.newcomer_protect_periods,
        newcomer_floor=config.newcomer_floor,
        newcomer_prior=config.newcomer_prior,
        weight_lower=config.weight_lower,
        weight_upper=config.weight_upper,
        band_constant=config.band_constant,
        alert_jump_threshold=config.alert_jump_threshold,
        alert_low_sigma=config.alert_low_sigma,
    )


def expire_adjustments(db: Session, period: EvalPeriod) -> int:
    rows = db.scalars(
        select(WeightAdjustment).where(WeightAdjustment.status == AdjustStatus.ACTIVE)
    ).all()
    expired = 0
    for row in rows:
        if not row.effective_to_period_id:
            continue
        end = db.get(EvalPeriod, row.effective_to_period_id)
        if end and end.code < period.code:
            row.status = AdjustStatus.EXPIRED
            expired += 1
    return expired


def collect_adjustments(db: Session, period: EvalPeriod) -> dict[int, list[AdjustmentInput]]:
    rows = db.scalars(
        select(WeightAdjustment).where(WeightAdjustment.status == AdjustStatus.ACTIVE)
    ).all()
    result: dict[int, list[AdjustmentInput]] = {}
    for index, row in enumerate(sorted(rows, key=lambda r: r.created_at or datetime.min)):
        start = db.get(EvalPeriod, row.effective_from_period_id)
        if not start or start.code > period.code:
            continue
        if row.effective_to_period_id:
            end = db.get(EvalPeriod, row.effective_to_period_id)
            if end and end.code < period.code:
                continue
        result.setdefault(row.employee_id, []).append(
            AdjustmentInput(
                adjustment_id=row.id,
                adjust_type=row.adjust_type,
                value=row.value,
                reason=row.reason,
                created_at_order=index,
            )
        )
    return result


def previous_published_period(db: Session, period: EvalPeriod) -> EvalPeriod | None:
    return db.scalar(
        select(EvalPeriod)
        .where(EvalPeriod.code < period.code, EvalPeriod.status == PeriodStatus.PUBLISHED)
        .order_by(EvalPeriod.code.desc())
    )


def build_inputs(db: Session, period: EvalPeriod, config: AlgoConfig):
    role_rows = db.scalars(
        select(ConfigRoleWeight).where(ConfigRoleWeight.config_id == config.id).order_by(ConfigRoleWeight.sort_order)
    ).all()
    role_configs = [
        RoleWeightConfig(r.role_code, r.label, r.weight, r.familiarity_full_sum, r.is_mandatory) for r in role_rows
    ]
    band_rows = db.scalars(
        select(ConfigGradeBand).where(ConfigGradeBand.config_id == config.id).order_by(ConfigGradeBand.sort_order)
    ).all()
    grade_bands = [GradeBandConfig(b.code, b.label, b.lower, b.upper) for b in band_rows]

    submission_rows = db.scalars(
        select(EvalSubmission).where(EvalSubmission.period_id == period.id)
    ).all()
    item_rows = db.scalars(
        select(EvalItemScore).where(
            EvalItemScore.submission_id.in_([s.id for s in submission_rows] or [0])
        )
    ).all()
    items_by_submission: dict[int, list[EvalItemScore]] = {}
    for row in item_rows:
        items_by_submission.setdefault(row.submission_id, []).append(row)

    users = {u.id: u.display_name for u in db.scalars(select(SysUser))}
    submissions = [
        SubmissionInput(
            submission_id=s.id,
            employee_id=s.employee_id,
            rater_user_id=s.rater_user_id,
            rater_name=users.get(s.rater_user_id, ""),
            role_code=s.role_code,
            status=s.status,
            familiarity_code=s.familiarity_code,
            familiarity_weight=s.familiarity_weight or 0.0,
            items=[
                ItemScoreInput(i.item_code, i.score, i.item_weight)
                for i in items_by_submission.get(s.id, [])
            ],
        )
        for s in submission_rows
    ]

    employee_rows = db.scalars(
        select(Employee)
        .where(Employee.deleted_at.is_(None), Employee.employment_status.in_(ACTIVE_STATUS_VALUES))
        .order_by(Employee.emp_no)
    ).all()

    prev_period = previous_published_period(db, period)
    prev_map: dict[int, float] = {}
    if prev_period:
        prev_map = {
            row.employee_id: row.w_final
            for row in db.scalars(
                select(WeightSnapshot).where(
                    WeightSnapshot.period_id == prev_period.id, WeightSnapshot.is_published
                )
            )
        }
    published_counts = dict(
        db.execute(
            select(WeightSnapshot.employee_id, func.count())
            .where(WeightSnapshot.is_published, WeightSnapshot.period_id != period.id)
            .group_by(WeightSnapshot.employee_id)
        ).all()
    )

    reference = date(period.year, period.month, 1)
    employees = [
        EmployeeContext(
            employee_id=e.id,
            emp_no=e.emp_no,
            name=e.name,
            employment_status=e.employment_status,
            prev_final=prev_map.get(e.id),
            published_periods=published_counts.get(e.id, 0),
            tenure_months=tenure_months(e.hired_at, reference),
        )
        for e in employee_rows
    ]
    return submissions, employees, role_configs, grade_bands


def run_batch(
    db: Session,
    period: EvalPeriod,
    user_id: int | None,
    run_type: str = "draft",
    dry_run: bool = False,
    extra_adjustments: dict[int, list[AdjustmentInput]] | None = None,
) -> dict:
    if period.status == PeriodStatus.DRAFT:
        raise StateConflictError("周期还没有开启，没有可计算的评价数据")
    if period.status == PeriodStatus.ARCHIVED:
        raise StateConflictError("已归档的周期不可重新计算")
    config = db.get(AlgoConfig, period.config_id) if period.config_id else None
    if not config:
        raise StateConflictError("周期没有绑定算法配置，无法跑批")

    started = now()
    expired = 0 if dry_run else expire_adjustments(db, period)
    submissions, employees, role_configs, grade_bands = build_inputs(db, period, config)
    params = build_params(config)
    adjustments = collect_adjustments(db, period)
    for employee_id, items in (extra_adjustments or {}).items():
        adjustments.setdefault(employee_id, []).extend(items)

    snapshots, stats, alerts = run_pipeline(
        submissions, employees, role_configs, grade_bands, params, adjustments
    )

    counted = [s for s in submissions if s.counted]
    stats["expiredAdjustments"] = expired
    stats["submittedCount"] = len(counted)
    stats["unknownCount"] = len([s for s in submissions if s.status == SubmissionStatus.UNKNOWN])
    stats["pendingCount"] = len([s for s in submissions if s.status == SubmissionStatus.PENDING])

    preview = [
        {
            "employeeId": s.employee_id,
            "rankNo": s.rank_no,
            "wFinal": s.w_final,
            "wRaw": s.w_raw,
            "wPrev": s.w_prev,
            "gradeCode": s.grade_code,
            "coverageScore": s.coverage_score,
            "coverageLevel": s.coverage_level,
            "raterCount": s.rater_count,
            "effectiveN": s.effective_n,
            "scoreBand": s.score_band,
            "missingRoles": s.missing_roles,
            "isFrozen": s.is_frozen,
            "isCarryForward": s.is_carry_forward,
            "floorApplied": s.floor_applied,
            "adjustSummary": s.adjust_summary,
        }
        for s in sorted(snapshots, key=lambda x: (x.rank_no or 9999, x.employee_id))
    ]

    if dry_run:
        return {
            "runId": None,
            "dryRun": True,
            "status": RunStatus.SUCCESS,
            "durationMs": int((now() - started).total_seconds() * 1000),
            "stats": stats,
            "alerts": [{"level": a.level, "code": a.code, "message": a.message, "employeeId": a.employee_id} for a in alerts],
            "preview": preview,
        }

    run_no = (db.scalar(select(func.max(WeightRun.run_no)).where(WeightRun.period_id == period.id)) or 0) + 1
    run = WeightRun(
        period_id=period.id,
        run_no=run_no,
        run_type=run_type,
        status=RunStatus.SUCCESS,
        config_id=config.id,
        started_at=started,
        triggered_by=user_id,
    )
    db.add(run)
    db.flush()

    for snapshot in snapshots:
        row = WeightSnapshot(
            run_id=run.id,
            period_id=period.id,
            employee_id=snapshot.employee_id,
            s_subj=snapshot.s_subj,
            s_obj=snapshot.s_obj,
            obj_available=snapshot.obj_available,
            w_raw=snapshot.w_raw,
            w_prev=snapshot.w_prev,
            smooth_alpha=snapshot.smooth_alpha,
            w_smooth=snapshot.w_smooth,
            floor_applied=snapshot.floor_applied,
            w_adjusted=snapshot.w_adjusted,
            w_final=snapshot.w_final,
            grade_code=snapshot.grade_code,
            rank_no=snapshot.rank_no,
            rank_pct=snapshot.rank_pct,
            coverage_score=snapshot.coverage_score,
            coverage_level=snapshot.coverage_level,
            gamma=snapshot.gamma,
            rater_count=snapshot.rater_count,
            effective_n=snapshot.effective_n,
            score_band=snapshot.score_band,
            covered_roles=json.dumps(snapshot.covered_roles, ensure_ascii=False),
            missing_roles=json.dumps(snapshot.missing_roles, ensure_ascii=False),
            is_frozen=snapshot.is_frozen,
            is_carry_forward=snapshot.is_carry_forward,
            adjust_summary=snapshot.adjust_summary,
            detail_json=json.dumps(
                [
                    {
                        "raterUserId": d.rater_user_id,
                        "raterName": d.rater_name,
                        "roleCode": d.role_code,
                        "familiarityCode": d.familiarity_code,
                        "familiarityWeight": d.familiarity_weight,
                        "rawScore": d.raw_score,
                        "zValue": d.z_value,
                        "normScore": d.norm_score,
                    }
                    for d in snapshot.rater_details
                ],
                ensure_ascii=False,
            ),
        )
        db.add(row)
        db.flush()
        for block in snapshot.blocks:
            db.add(
                WeightRoleBlock(
                    snapshot_id=row.id,
                    role_code=block.role_code,
                    block_score=block.block_score,
                    nominal_weight=block.nominal_weight,
                    credibility=block.credibility,
                    applied_weight=block.applied_weight,
                    rater_count=block.rater_count,
                    familiarity_sum=block.familiarity_sum,
                    effective_n=block.effective_n,
                    was_missing=block.was_missing,
                )
            )
        for trace in snapshot.adjust_traces:
            db.add(
                SnapshotAdjustmentLink(
                    snapshot_id=row.id,
                    adjustment_id=trace.adjustment_id,
                    apply_order=trace.apply_order,
                    adjust_type=trace.adjust_type,
                    value_used=trace.value_used,
                    value_before=trace.value_before,
                    value_after=trace.value_after,
                    was_effective=trace.was_effective,
                    skip_reason=trace.skip_reason,
                )
            )

    for alert in alerts:
        db.add(
            WeightAlert(
                run_id=run.id,
                period_id=period.id,
                level=alert.level,
                code=alert.code,
                employee_id=alert.employee_id,
                rater_user_id=alert.rater_user_id,
                message=alert.message,
            )
        )

    finished = now()
    run.finished_at = finished
    run.duration_ms = int((finished - started).total_seconds() * 1000)
    run.stats_json = json.dumps(stats, ensure_ascii=False, default=str)
    if period.status != PeriodStatus.PUBLISHED:
        period.status = PeriodStatus.COMPUTED

    return {
        "runId": run.id,
        "runNo": run_no,
        "dryRun": False,
        "status": RunStatus.SUCCESS,
        "durationMs": run.duration_ms,
        "stats": stats,
        "alerts": [{"level": a.level, "code": a.code, "message": a.message, "employeeId": a.employee_id} for a in alerts],
        "preview": preview,
    }
