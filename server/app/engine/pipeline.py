from app.engine.adjust import apply_adjustments
from app.engine.aggregate import compose_subjective, coverage_level, merge_blocks
from app.engine.grade import assign_grade, assign_ranks, score_band
from app.engine.smooth import apply_newcomer_floor, compose_raw, finalize, smooth_score
from app.engine.standardize import build_rater_stats, item_weighted_score, normalize_score
from app.engine.types import (
    AdjustmentInput,
    AlertItem,
    AlgoParams,
    EmployeeContext,
    GradeBandConfig,
    RoleWeightConfig,
    SnapshotResult,
    SubmissionInput,
)


def run_pipeline(
    submissions: list[SubmissionInput],
    employees: list[EmployeeContext],
    role_configs: list[RoleWeightConfig],
    grade_bands: list[GradeBandConfig],
    params: AlgoParams,
    adjustments: dict[int, list[AdjustmentInput]] | None = None,
    history_pool: dict[str, list[float]] | None = None,
) -> tuple[list[SnapshotResult], dict, list[AlertItem]]:
    adjustments = adjustments or {}
    rater_stats, pool, alerts = build_rater_stats(submissions, params, history_pool)

    normalized: dict[int, tuple[float, float]] = {}
    for submission in submissions:
        if not submission.counted:
            continue
        raw = item_weighted_score(submission)
        stat = rater_stats.get((submission.rater_user_id, submission.role_code))
        normalized[submission.submission_id] = normalize_score(
            raw, stat, pool.get(submission.role_code), params
        )

    by_employee: dict[int, list[SubmissionInput]] = {}
    for submission in submissions:
        by_employee.setdefault(submission.employee_id, []).append(submission)

    mandatory_roles = [c.role_code for c in role_configs if c.is_mandatory]
    snapshots: list[SnapshotResult] = []

    for employee in employees:
        rows = by_employee.get(employee.employee_id, [])
        blocks, details = merge_blocks(rows, normalized, role_configs, params)
        prior = employee.prev_final if employee.prev_final is not None else params.newcomer_prior

        covered = [b.role_code for b in blocks if b.block_score is not None]
        missing = [b.role_code for b in blocks if b.block_score is None]
        lead_missing = any(role not in covered for role in mandatory_roles)

        s_subj, omega, gamma = compose_subjective(blocks, params, prior)
        carry_forward = False

        if params.require_lead_block and lead_missing:
            carry_forward = True
            base_value = employee.prev_final if employee.prev_final is not None else params.newcomer_floor
            w_raw = base_value
            w_smooth = base_value
            alpha = None
            floor_applied = False
            alerts.append(
                AlertItem(
                    level="error",
                    code="MISSING_LEAD",
                    message=f"{employee.name} 缺少直属主管评价，本期沿用上期分数 {round(base_value, 2)}，请补录",
                    employee_id=employee.employee_id,
                )
            )
        else:
            w_raw, _ = compose_raw(s_subj, None, params)
            w_smooth, alpha = smooth_score(w_raw, employee, params)
            w_smooth, floor_applied = apply_newcomer_floor(w_smooth, employee, params)

        w_adjusted, frozen, traces, adjust_summary = apply_adjustments(
            w_smooth, adjustments.get(employee.employee_id, []), params
        )
        w_final = 0.0 if frozen else finalize(w_adjusted, params)

        effective_n = sum(b.effective_n for b in blocks)
        rater_count = sum(b.rater_count for b in blocks)

        if omega < 0.30 and not carry_forward:
            alerts.append(
                AlertItem(
                    level="warn",
                    code="LOW_COVERAGE",
                    message=f"{employee.name} 的评价覆盖度仅 {round(omega * 100)}%，分数主要来自历史值，参考价值有限",
                    employee_id=employee.employee_id,
                )
            )
        if employee.prev_final is not None and abs(w_final - employee.prev_final) >= params.alert_jump_threshold:
            alerts.append(
                AlertItem(
                    level="warn",
                    code="SCORE_JUMP",
                    message=f"{employee.name} 本期 {round(w_final, 1)} 分，较上期 {round(employee.prev_final, 1)} 分波动超过 {params.alert_jump_threshold} 分，建议核查",
                    employee_id=employee.employee_id,
                )
            )

        snapshots.append(
            SnapshotResult(
                employee_id=employee.employee_id,
                s_subj=round(s_subj, 4),
                s_obj=None,
                obj_available=False,
                w_raw=round(w_raw, 4),
                w_prev=employee.prev_final,
                smooth_alpha=alpha,
                w_smooth=round(w_smooth, 4),
                floor_applied=floor_applied,
                w_adjusted=round(w_adjusted, 4),
                w_final=round(w_final, 4),
                grade_code="F" if frozen else assign_grade(w_final, grade_bands),
                rank_no=None,
                rank_pct=None,
                coverage_score=round(omega, 4),
                coverage_level=coverage_level(omega),
                gamma=round(gamma, 4),
                rater_count=rater_count,
                effective_n=round(effective_n, 4),
                score_band=score_band(effective_n, params),
                covered_roles=covered,
                missing_roles=missing,
                is_frozen=frozen,
                is_carry_forward=carry_forward,
                adjust_summary=adjust_summary,
                blocks=blocks,
                rater_details=details,
                adjust_traces=traces,
            )
        )

    assign_ranks(snapshots)

    stats = {
        "raterStats": [
            {
                "raterUserId": s.rater_user_id,
                "roleCode": s.role_code,
                "n": s.n,
                "mean": s.mean,
                "std": s.std,
                "lambda": s.lam,
                "muHat": s.mu_hat,
                "sigmaHat": s.sigma_hat,
                "lowVariance": s.low_variance,
            }
            for s in rater_stats.values()
        ],
        "pool": {k: {"mean": round(v[0], 4), "std": round(v[1], 4), "count": v[2]} for k, v in pool.items()},
        "employeeCount": len(employees),
        "submissionCount": len([s for s in submissions if s.counted]),
    }
    return snapshots, stats, alerts
