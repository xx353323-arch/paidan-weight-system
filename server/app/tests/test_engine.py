from math import isclose, sqrt

from app.engine.adjust import apply_adjustments
from app.engine.aggregate import compose_subjective, coverage_level, merge_blocks
from app.engine.grade import assign_grade, assign_ranks
from app.engine.pipeline import run_pipeline
from app.engine.smooth import pick_alpha, smooth_score
from app.engine.standardize import build_rater_stats, item_weighted_score, normalize_score
from app.engine.types import (
    AdjustmentInput,
    AlgoParams,
    EmployeeContext,
    GradeBandConfig,
    ItemScoreInput,
    RoleWeightConfig,
    SnapshotResult,
    SubmissionInput,
)

PARAMS = AlgoParams()

ROLES = [
    RoleWeightConfig("editor_lead", "直属编辑主管", 0.45, 1.0, True),
    RoleWeightConfig("delivery", "交付对接", 0.25, 1.2, False),
    RoleWeightConfig("cs", "客服主管", 0.18, 1.0, False),
    RoleWeightConfig("hr", "人事主管", 0.12, 1.0, False),
]

BANDS = [
    GradeBandConfig("S", "S档", 90.0, 100.0),
    GradeBandConfig("A", "A档", 80.0, 89.999),
    GradeBandConfig("B", "B档", 70.0, 79.999),
    GradeBandConfig("C", "C档", 60.0, 69.999),
    GradeBandConfig("D", "D档", 0.0, 59.999),
]

LEAD_ITEMS = [("quality", 0.35), ("expertise", 0.25), ("revision", 0.20), ("punctuality", 0.20)]


def lead_submission(sid, employee_id, scores, familiarity=1.0, rater=100, status="SUBMITTED"):
    return SubmissionInput(
        submission_id=sid,
        employee_id=employee_id,
        rater_user_id=rater,
        rater_name="主管A",
        role_code="editor_lead",
        status=status,
        familiarity_code="VERY",
        familiarity_weight=familiarity,
        items=[ItemScoreInput(code, score, weight) for (code, weight), score in zip(LEAD_ITEMS, scores)],
    )


def simple_submission(sid, employee_id, role, raw, familiarity, rater, name="评价人"):
    return SubmissionInput(
        submission_id=sid,
        employee_id=employee_id,
        rater_user_id=rater,
        rater_name=name,
        role_code=role,
        status="SUBMITTED",
        familiarity_code="VERY",
        familiarity_weight=familiarity,
        items=[ItemScoreInput("single", raw, 1.0)],
    )


def test_item_weighted_score():
    s = lead_submission(1, 1, [4, 4, 5, 3])
    assert isclose(item_weighted_score(s), 4.00, abs_tol=1e-9)
    s2 = lead_submission(2, 2, [2, 3, 3, 3])
    assert isclose(item_weighted_score(s2), 2.65, abs_tol=1e-9)


def test_lambda_shrinkage_curve():
    for n, expected in [(3, 0.375), (5, 0.5), (10, 2 / 3), (20, 0.8)]:
        subs = [lead_submission(i, i, [4, 4, 4, 4]) for i in range(n)]
        for idx, s in enumerate(subs):
            s.items[0].score = 3 + (idx % 3)
        stats, _, _ = build_rater_stats(subs, PARAMS)
        stat = stats[(100, "editor_lead")]
        assert isclose(stat.lam, round(expected, 4), abs_tol=1e-3), f"n={n} 期望 {expected} 实得 {stat.lam}"


def test_small_sample_falls_back_to_pool():
    subs = [lead_submission(1, 1, [4, 4, 4, 4]), lead_submission(2, 2, [3, 3, 3, 3])]
    stats, pool, _ = build_rater_stats(subs, PARAMS)
    stat = stats[(100, "editor_lead")]
    assert stat.n == 2
    assert stat.lam == 0.0
    assert isclose(stat.mu_hat, pool["editor_lead"][0], abs_tol=1e-6)


def test_normalize_matches_manual_formula():
    subs = [lead_submission(i, i, [4, 4, 4, 4]) for i in range(6)]
    for idx, s in enumerate(subs):
        for item in s.items:
            item.score = [3, 4, 5, 4, 3, 5][idx]
    stats, pool, _ = build_rater_stats(subs, PARAMS)
    stat = stats[(100, "editor_lead")]
    raw = 4.0
    norm, z = normalize_score(raw, stat, pool["editor_lead"], PARAMS)
    expected_z = (raw - stat.mu_hat) / stat.sigma_hat
    s_z = PARAMS.score_center + PARAMS.score_scale * expected_z
    s_abs = PARAMS.abs_base + PARAMS.abs_step * (raw - 1)
    expected = PARAMS.z_blend_beta * s_z + (1 - PARAMS.z_blend_beta) * s_abs
    assert isclose(z, expected_z, abs_tol=1e-6)
    assert isclose(norm, expected, abs_tol=1e-6)


def test_familiarity_weighted_merge():
    subs = [
        simple_submission(1, 1, "delivery", 4.33, 1.0, 201, "甲"),
        simple_submission(2, 1, "delivery", 3.67, 0.6, 202, "乙"),
        simple_submission(3, 1, "delivery", 4.0, 0.0, 203, "丙"),
    ]
    subs[2].status = "UNKNOWN"
    normalized = {1: (78.0, 0.0), 2: (70.5, 0.0), 3: (0.0, 0.0)}
    blocks, details = merge_blocks(subs, normalized, ROLES, PARAMS)
    delivery = next(b for b in blocks if b.role_code == "delivery")
    assert isclose(delivery.block_score, (1.0 * 78.0 + 0.6 * 70.5) / 1.6, abs_tol=1e-4)
    assert isclose(delivery.familiarity_sum, 1.6, abs_tol=1e-9)
    assert isclose(delivery.effective_n, 1.6**2 / (1.0**2 + 0.6**2), abs_tol=1e-4)
    assert delivery.credibility == 1.0
    assert delivery.rater_count == 2
    assert len(details) == 2


def test_single_delivery_gets_partial_credibility():
    subs = [simple_submission(1, 1, "delivery", 4.0, 1.0, 201, "甲")]
    blocks, _ = merge_blocks(subs, {1: (80.0, 0.0)}, ROLES, PARAMS)
    delivery = next(b for b in blocks if b.role_code == "delivery")
    assert isclose(delivery.credibility, round(1.0 / 1.2, 4), abs_tol=1e-4)


def test_coverage_and_redistribution():
    subs = [
        simple_submission(1, 1, "editor_lead", 4.0, 1.0, 101, "主管"),
        simple_submission(2, 1, "delivery", 4.0, 1.0, 201, "甲"),
        simple_submission(3, 1, "delivery", 4.0, 0.6, 202, "乙"),
        simple_submission(4, 1, "hr", 4.0, 0.6, 401, "人事"),
    ]
    normalized = {1: (75.875, 0.0), 2: (78.0, 0.0), 3: (70.5, 0.0), 4: (76.0, 0.0)}
    blocks, _ = merge_blocks(subs, normalized, ROLES, PARAMS)
    s_subj, omega, gamma = compose_subjective(blocks, PARAMS, prior=78.0)
    assert isclose(omega, 0.45 * 1.0 + 0.25 * 1.0 + 0.12 * 0.6, abs_tol=1e-6)
    assert isclose(omega, 0.772, abs_tol=1e-6)
    assert gamma == 1.0
    expected = (0.45 * 75.875 + 0.25 * 75.1875 + 0.072 * 76.0) / 0.772
    assert isclose(s_subj, expected, abs_tol=1e-4)
    assert isclose(s_subj, 75.6641, abs_tol=1e-3)
    cs_block = next(b for b in blocks if b.role_code == "cs")
    assert cs_block.was_missing and cs_block.applied_weight == 0.0


def test_thin_coverage_pulls_toward_prior():
    subs = [simple_submission(1, 1, "hr", 4.0, 1.0, 401, "人事")]
    blocks, _ = merge_blocks(subs, {1: (90.0, 0.0)}, ROLES, PARAMS)
    s_subj, omega, gamma = compose_subjective(blocks, PARAMS, prior=70.0)
    assert isclose(omega, 0.12, abs_tol=1e-9)
    assert isclose(gamma, 0.2, abs_tol=1e-9)
    assert isclose(s_subj, 0.2 * 90.0 + 0.8 * 70.0, abs_tol=1e-6)
    assert coverage_level(omega) == "THIN"


def test_smoothing_alpha_by_tenure():
    assert pick_alpha(0, PARAMS) == 1.0
    assert pick_alpha(1, PARAMS) == 0.85
    assert pick_alpha(2, PARAMS) == 0.70
    assert pick_alpha(9, PARAMS) == 0.70
    ctx = EmployeeContext(1, "E001", "张三", "regular", prev_final=78.0, published_periods=3)
    value, alpha = smooth_score(75.6641, ctx, PARAMS)
    assert alpha == 0.70
    assert isclose(value, 0.7 * 75.6641 + 0.3 * 78.0, abs_tol=1e-6)
    assert isclose(value, 76.3649, abs_tol=1e-3)


def test_adjust_priority_freeze_wins():
    adjustments = [
        AdjustmentInput(1, "MULTIPLIER", 0.5, "降权", 1),
        AdjustmentInput(2, "FREEZE", None, "离职", 2),
        AdjustmentInput(3, "OVERRIDE", 90.0, "特批", 3),
    ]
    value, frozen, traces, summary = apply_adjustments(80.0, adjustments, PARAMS)
    assert frozen and value == 0.0
    assert sum(1 for t in traces if t.was_effective) == 1
    assert next(t for t in traces if t.was_effective).adjust_type == "FREEZE"


def test_adjust_override_beats_multiplier():
    adjustments = [
        AdjustmentInput(1, "MULTIPLIER", 0.5, "降权", 1),
        AdjustmentInput(2, "DELTA", -5.0, "处罚", 2),
        AdjustmentInput(3, "OVERRIDE", 85.0, "特批", 3),
    ]
    value, frozen, traces, _ = apply_adjustments(80.0, adjustments, PARAMS)
    assert not frozen and value == 85.0
    skipped = [t for t in traces if not t.was_effective]
    assert len(skipped) == 2
    assert all(t.skip_reason == "OVERRIDE_TAKES_PRECEDENCE" for t in skipped)


def test_adjust_multiply_then_add():
    adjustments = [
        AdjustmentInput(1, "MULTIPLIER", 0.5, "待淘汰", 1),
        AdjustmentInput(2, "DELTA", -5.0, "违纪", 2),
    ]
    value, frozen, _, summary = apply_adjustments(80.0, adjustments, PARAMS)
    assert not frozen
    assert isclose(value, 80.0 * 0.5 - 5.0, abs_tol=1e-9)
    assert "乘以 0.5" in summary and "减 5.0 分" in summary


def test_grade_and_tie_rank():
    assert assign_grade(95.0, BANDS) == "S"
    assert assign_grade(80.0, BANDS) == "A"
    assert assign_grade(76.36, BANDS) == "B"
    assert assign_grade(59.0, BANDS) == "D"
    snaps = [
        SnapshotResult(employee_id=i, s_subj=0, s_obj=None, obj_available=False, w_raw=0, w_prev=None,
                       smooth_alpha=None, w_smooth=0, floor_applied=False, w_adjusted=0, w_final=score,
                       grade_code=None, rank_no=None, rank_pct=None, coverage_score=1.0, coverage_level="HIGH",
                       gamma=1.0, rater_count=1, effective_n=1.0, score_band=None, covered_roles=[],
                       missing_roles=[], is_frozen=False, is_carry_forward=False, adjust_summary=None)
        for i, score in enumerate([90.0, 80.0, 80.0, 70.0], start=1)
    ]
    assign_ranks(snaps)
    assert [s.rank_no for s in snaps] == [1, 2, 2, 4]


def test_frozen_excluded_from_rank():
    snaps = [
        SnapshotResult(employee_id=i, s_subj=0, s_obj=None, obj_available=False, w_raw=0, w_prev=None,
                       smooth_alpha=None, w_smooth=0, floor_applied=False, w_adjusted=0, w_final=score,
                       grade_code=None, rank_no=None, rank_pct=None, coverage_score=1.0, coverage_level="HIGH",
                       gamma=1.0, rater_count=1, effective_n=1.0, score_band=None, covered_roles=[],
                       missing_roles=[], is_frozen=frozen, is_carry_forward=False, adjust_summary=None)
        for i, (score, frozen) in enumerate([(90.0, False), (0.0, True), (70.0, False)], start=1)
    ]
    assign_ranks(snaps)
    assert snaps[0].rank_no == 1
    assert snaps[1].rank_no is None
    assert snaps[2].rank_no == 2


def test_missing_lead_carries_forward():
    subs = [simple_submission(1, 1, "hr", 4.0, 1.0, 401, "人事")]
    employees = [EmployeeContext(1, "E001", "张三", "regular", prev_final=78.0, published_periods=3)]
    snapshots, _, alerts = run_pipeline(subs, employees, ROLES, BANDS, PARAMS)
    snap = snapshots[0]
    assert snap.is_carry_forward
    assert isclose(snap.w_final, 78.0, abs_tol=1e-6)
    assert any(a.code == "MISSING_LEAD" for a in alerts)


def test_newcomer_floor_applies():
    subs = [simple_submission(1, 1, "editor_lead", 1.0, 1.0, 101, "主管")]
    employees = [EmployeeContext(1, "E001", "新人", "probation", prev_final=None, published_periods=0, tenure_months=1)]
    snapshots, _, _ = run_pipeline(subs, employees, ROLES, BANDS, PARAMS)
    snap = snapshots[0]
    assert snap.floor_applied
    assert snap.w_final == PARAMS.newcomer_floor


def test_unknown_tenure_does_not_get_floor():
    subs = [simple_submission(1, 1, "editor_lead", 1.0, 1.0, 101, "主管")]
    employees = [EmployeeContext(1, "E001", "老员工", "regular", prev_final=None, published_periods=0, tenure_months=None)]
    snapshots, _, _ = run_pipeline(subs, employees, ROLES, BANDS, PARAMS)
    assert not snapshots[0].floor_applied
    assert snapshots[0].w_final < PARAMS.newcomer_floor


def test_long_tenure_does_not_get_floor():
    subs = [simple_submission(1, 1, "editor_lead", 1.0, 1.0, 101, "主管")]
    employees = [EmployeeContext(1, "E001", "老员工", "regular", prev_final=None, published_periods=0, tenure_months=24)]
    snapshots, _, _ = run_pipeline(subs, employees, ROLES, BANDS, PARAMS)
    assert not snapshots[0].floor_applied


def test_end_to_end_golden_case():
    subs = [
        lead_submission(1, 1, [4, 4, 5, 3], rater=101),
        lead_submission(2, 2, [3, 3, 3, 4], rater=101),
        lead_submission(3, 3, [5, 5, 4, 5], rater=101),
        lead_submission(4, 4, [4, 5, 4, 4], rater=101),
        lead_submission(5, 5, [3, 4, 4, 3], rater=101),
        lead_submission(6, 6, [5, 4, 5, 4], rater=101),
        simple_submission(7, 1, "delivery", 4.33, 1.0, 201, "甲"),
        simple_submission(8, 1, "delivery", 3.67, 0.6, 202, "乙"),
        simple_submission(9, 1, "hr", 4.2, 0.6, 401, "人事"),
        simple_submission(10, 2, "delivery", 4.0, 1.0, 201, "甲"),
        simple_submission(11, 2, "hr", 3.5, 1.0, 401, "人事"),
    ]
    subs[0].rater_name = "主管A"
    employees = [
        EmployeeContext(1, "E001", "张三", "regular", prev_final=78.0, published_periods=3),
        EmployeeContext(2, "E002", "李四", "regular", prev_final=72.0, published_periods=3),
    ]
    snapshots, stats, alerts = run_pipeline(subs, employees, ROLES, BANDS, PARAMS)
    assert len(snapshots) == 2
    zhang = next(s for s in snapshots if s.employee_id == 1)
    li = next(s for s in snapshots if s.employee_id == 2)

    assert isclose(zhang.coverage_score, 0.45 + 0.25 + 0.12 * 0.6, abs_tol=1e-6)
    assert zhang.coverage_level == "MEDIUM"
    assert zhang.missing_roles == ["cs"]
    assert zhang.gamma == 1.0
    assert zhang.smooth_alpha == 0.70
    assert zhang.rank_no == 1
    assert li.rank_no == 2
    assert zhang.w_final > li.w_final
    assert zhang.grade_code in ("A", "B")
    assert isclose(zhang.effective_n, 1.0 + 1.6**2 / (1 + 0.36) + 1.0, abs_tol=1e-3)
    assert isclose(zhang.score_band, round(10 / sqrt(zhang.effective_n), 2), abs_tol=1e-2)
    lead_stat = next(s for s in stats["raterStats"] if s["roleCode"] == "editor_lead")
    assert lead_stat["n"] == 6
    assert isclose(lead_stat["lambda"], round(6 / 11, 4), abs_tol=1e-4)


def test_single_rater_falls_back_to_absolute_score():
    for raw, expected in [(1.0, 40.0), (3.0, 70.0), (5.0, 100.0)]:
        subs = [simple_submission(1, 1, "editor_lead", raw, 1.0, 101, "主管")]
        stats, pool, _ = build_rater_stats(subs, PARAMS)
        stat = stats[(101, "editor_lead")]
        norm, z = normalize_score(raw, stat, pool["editor_lead"], PARAMS)
        assert z == 0.0
        assert isclose(norm, expected, abs_tol=1e-6), f"{raw} 分应得 {expected}，实得 {norm}"


def test_pool_without_discrimination_uses_absolute_score():
    subs = [simple_submission(i, i, "editor_lead", 4.0, 1.0, 101, "主管") for i in range(1, 6)]
    stats, pool, alerts = build_rater_stats(subs, PARAMS)
    stat = stats[(101, "editor_lead")]
    norm, z = normalize_score(4.0, stat, pool["editor_lead"], PARAMS)
    assert z == 0.0
    assert isclose(norm, PARAMS.abs_base + PARAMS.abs_step * 3, abs_tol=1e-6)
    assert any(a.code == "BLOCK_NO_DISCRIMINATION" for a in alerts)
