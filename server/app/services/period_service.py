from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import ACTIVE_EMPLOYMENT, CoverageMode, PeriodStatus, RoleCode, SubmissionStatus
from app.core.errors import NotFoundError, StateConflictError
from app.db.base import now
from app.models import (
    AlgoConfig,
    Employee,
    EvalPeriod,
    EvalRelation,
    EvalSubmission,
    RaterProfile,
    SysUser,
)

ACTIVE_STATUS_VALUES = [s.value for s in ACTIVE_EMPLOYMENT]


def active_employee_ids(db: Session) -> list[int]:
    return list(
        db.scalars(
            select(Employee.id)
            .where(Employee.deleted_at.is_(None), Employee.employment_status.in_(ACTIVE_STATUS_VALUES))
            .order_by(Employee.emp_no)
        )
    )


def get_period_or_404(db: Session, period_id: int) -> EvalPeriod:
    period = db.get(EvalPeriod, period_id)
    if not period:
        raise NotFoundError("评价周期不存在")
    return period


def active_config(db: Session) -> AlgoConfig | None:
    return db.scalar(select(AlgoConfig).where(AlgoConfig.status == "active"))


def materialize_tasks(db: Session, period: EvalPeriod) -> dict:
    employee_ids = active_employee_ids(db)
    employee_set = set(employee_ids)
    profiles = db.scalars(select(RaterProfile).where(RaterProfile.is_active)).all()

    existing = set(
        db.execute(
            select(EvalSubmission.employee_id, EvalSubmission.rater_user_id, EvalSubmission.role_code).where(
                EvalSubmission.period_id == period.id
            )
        ).all()
    )

    profile_user_ids = {p.user_id for p in profiles}
    rater_names = (
        dict(db.execute(select(SysUser.id, SysUser.display_name).where(SysUser.id.in_(profile_user_ids))).all())
        if profile_user_ids
        else {}
    )
    relation_targets: dict[tuple[int, str], list[int]] = {}
    if profile_user_ids:
        for rater_user_id, role_code, employee_id in db.execute(
            select(EvalRelation.rater_user_id, EvalRelation.role_code, EvalRelation.employee_id)
            .where(EvalRelation.rater_user_id.in_(profile_user_ids), EvalRelation.is_active)
            .order_by(EvalRelation.id)
        ).all():
            relation_targets.setdefault((rater_user_id, role_code), []).append(employee_id)

    created = 0
    per_rater: dict[str, int] = {}
    for profile in profiles:
        if profile.coverage_mode == CoverageMode.ALL:
            targets = employee_ids
            source = "covers_all"
        else:
            targets = [
                eid
                for eid in relation_targets.get((profile.user_id, profile.role_code), [])
                if eid in employee_set
            ]
            source = "relation"

        key = f"{rater_names.get(profile.user_id, profile.user_id)}:{profile.role_code}"
        for employee_id in targets:
            if (employee_id, profile.user_id, profile.role_code) in existing:
                continue
            db.add(
                EvalSubmission(
                    period_id=period.id,
                    employee_id=employee_id,
                    rater_user_id=profile.user_id,
                    role_code=profile.role_code,
                    source=source,
                    status=SubmissionStatus.PENDING,
                )
            )
            created += 1
            per_rater[key] = per_rater.get(key, 0) + 1

    db.flush()

    covered_lead = set(
        db.scalars(
            select(EvalSubmission.employee_id).where(
                EvalSubmission.period_id == period.id,
                EvalSubmission.role_code == RoleCode.EDITOR_LEAD,
            )
        )
    )
    uncovered_ids = [eid for eid in employee_ids if eid not in covered_lead]
    uncovered_names = (
        dict(db.execute(select(Employee.id, Employee.name).where(Employee.id.in_(uncovered_ids))).all())
        if uncovered_ids
        else {}
    )
    uncovered = [{"employeeId": eid, "name": uncovered_names.get(eid, "")} for eid in uncovered_ids]

    return {
        "taskCount": created,
        "employeeCount": len(employee_ids),
        "raterCount": len(profiles),
        "perRater": per_rater,
        "uncoveredEmployees": uncovered,
    }


def open_period(db: Session, period: EvalPeriod) -> dict:
    if period.status not in (PeriodStatus.DRAFT, PeriodStatus.OPEN):
        raise StateConflictError("只有草稿状态的周期可以开启")
    running = db.scalar(
        select(EvalPeriod).where(EvalPeriod.status == PeriodStatus.OPEN, EvalPeriod.id != period.id)
    )
    if running:
        raise StateConflictError(f"周期 {running.code} 正在进行中，请先关闭后再开启新周期")
    config = active_config(db)
    if not config:
        raise StateConflictError("没有生效的算法配置，无法开启周期")
    result = materialize_tasks(db, period)
    period.status = PeriodStatus.OPEN
    period.config_id = config.id
    if not period.open_at:
        period.open_at = now()
    return result


def close_period(db: Session, period: EvalPeriod) -> dict:
    if period.status != PeriodStatus.OPEN:
        raise StateConflictError("只有进行中的周期可以关闭")
    rows = db.scalars(
        select(EvalSubmission).where(
            EvalSubmission.period_id == period.id,
            EvalSubmission.status.in_([SubmissionStatus.PENDING, SubmissionStatus.DRAFT]),
        )
    ).all()
    for row in rows:
        row.status = SubmissionStatus.EXPIRED
    period.status = PeriodStatus.CLOSED
    return {"expiredCount": len(rows)}


def period_progress(db: Session, period: EvalPeriod) -> dict:
    rows = db.execute(
        select(
            EvalSubmission.rater_user_id,
            EvalSubmission.role_code,
            EvalSubmission.status,
            func.count(),
        )
        .where(EvalSubmission.period_id == period.id)
        .group_by(EvalSubmission.rater_user_id, EvalSubmission.role_code, EvalSubmission.status)
    ).all()

    bucket: dict[tuple[int, str], dict] = {}
    for rater_user_id, role_code, status, count in rows:
        item = bucket.setdefault(
            (rater_user_id, role_code),
            {"total": 0, "submitted": 0, "unknown": 0, "draft": 0, "pending": 0, "expired": 0},
        )
        item["total"] += count
        if status == SubmissionStatus.SUBMITTED:
            item["submitted"] += count
        elif status == SubmissionStatus.UNKNOWN:
            item["unknown"] += count
        elif status == SubmissionStatus.DRAFT:
            item["draft"] += count
        elif status == SubmissionStatus.PENDING:
            item["pending"] += count
        elif status == SubmissionStatus.EXPIRED:
            item["expired"] += count

    rater_ids = {key[0] for key in bucket}
    names = (
        dict(db.execute(select(SysUser.id, SysUser.display_name).where(SysUser.id.in_(rater_ids))).all())
        if rater_ids
        else {}
    )
    last_saved_map = {
        (rater_user_id, role_code): saved_at
        for rater_user_id, role_code, saved_at in db.execute(
            select(
                EvalSubmission.rater_user_id,
                EvalSubmission.role_code,
                func.max(EvalSubmission.updated_at),
            )
            .where(
                EvalSubmission.period_id == period.id,
                EvalSubmission.status.in_([SubmissionStatus.SUBMITTED, SubmissionStatus.UNKNOWN, SubmissionStatus.DRAFT]),
            )
            .group_by(EvalSubmission.rater_user_id, EvalSubmission.role_code)
        ).all()
    }

    items = []
    total_all = 0
    done_all = 0
    for (rater_user_id, role_code), stat in bucket.items():
        done = stat["submitted"] + stat["unknown"]
        total_all += stat["total"]
        done_all += done
        last_saved = last_saved_map.get((rater_user_id, role_code))
        if stat["pending"] == stat["total"]:
            state = "not_started"
        elif done == stat["total"]:
            state = "finished"
        else:
            state = "in_progress"
        items.append(
            {
                "raterUserId": rater_user_id,
                "raterName": names.get(rater_user_id, ""),
                "roleCode": role_code,
                "total": stat["total"],
                "submitted": stat["submitted"],
                "unknown": stat["unknown"],
                "draft": stat["draft"],
                "pending": stat["pending"],
                "expired": stat["expired"],
                "done": done,
                "rate": round(done / stat["total"], 4) if stat["total"] else 0.0,
                "state": state,
                "lastSavedAt": last_saved,
            }
        )

    items.sort(key=lambda x: (x["rate"], x["raterName"]))
    return {
        "items": items,
        "summary": {
            "taskTotal": total_all,
            "taskDone": done_all,
            "rate": round(done_all / total_all, 4) if total_all else 0.0,
            "raterTotal": len(items),
            "raterFinished": sum(1 for i in items if i["state"] == "finished"),
        },
    }
