from dataclasses import dataclass, field


@dataclass
class ItemScoreInput:
    item_code: str
    score: int
    weight: float


@dataclass
class SubmissionInput:
    submission_id: int
    employee_id: int
    rater_user_id: int
    rater_name: str
    role_code: str
    status: str
    familiarity_code: str | None
    familiarity_weight: float
    items: list[ItemScoreInput] = field(default_factory=list)

    @property
    def counted(self) -> bool:
        return self.status == "SUBMITTED" and self.familiarity_weight > 0


@dataclass
class RoleWeightConfig:
    role_code: str
    label: str
    weight: float
    familiarity_full_sum: float
    is_mandatory: bool


@dataclass
class GradeBandConfig:
    code: str
    label: str
    lower: float
    upper: float


@dataclass
class AlgoParams:
    score_center: float = 75.0
    score_scale: float = 8.0
    score_clip_low: float = 30.0
    score_clip_high: float = 100.0
    z_min_n: int = 3
    z_shrink_k: float = 5.0
    z_sigma_floor: float = 0.30
    z_blend_beta: float = 0.70
    abs_base: float = 40.0
    abs_step: float = 15.0
    pool_min_count: int = 8
    coverage_full_threshold: float = 0.60
    require_lead_block: bool = True
    objective_enabled: bool = False
    subj_weight: float = 0.60
    obj_weight: float = 0.40
    smooth_alpha: tuple[float, ...] = (1.0, 0.85, 0.70)
    newcomer_protect_periods: int = 2
    newcomer_floor: float = 65.0
    newcomer_prior: float = 75.0
    weight_lower: float = 0.0
    weight_upper: float = 100.0
    band_constant: float = 10.0
    alert_jump_threshold: float = 15.0
    alert_low_sigma: float = 0.30


@dataclass
class EmployeeContext:
    employee_id: int
    emp_no: str
    name: str
    employment_status: str
    prev_final: float | None = None
    published_periods: int = 0
    tenure_months: int | None = None


@dataclass
class AdjustmentInput:
    adjustment_id: int
    adjust_type: str
    value: float | None
    reason: str
    created_at_order: int


@dataclass
class RaterStat:
    rater_user_id: int
    role_code: str
    n: int
    mean: float
    std: float
    lam: float
    mu_hat: float
    sigma_hat: float
    low_variance: bool = False


@dataclass
class RaterDetail:
    rater_user_id: int
    rater_name: str
    role_code: str
    familiarity_code: str | None
    familiarity_weight: float
    raw_score: float
    z_value: float
    norm_score: float


@dataclass
class BlockResult:
    role_code: str
    block_score: float | None
    nominal_weight: float
    credibility: float
    applied_weight: float
    rater_count: int
    familiarity_sum: float
    effective_n: float
    was_missing: bool


@dataclass
class AdjustTrace:
    adjustment_id: int
    adjust_type: str
    value_used: float | None
    value_before: float | None
    value_after: float | None
    was_effective: bool
    skip_reason: str | None
    apply_order: int


@dataclass
class AlertItem:
    level: str
    code: str
    message: str
    employee_id: int | None = None
    rater_user_id: int | None = None


@dataclass
class SnapshotResult:
    employee_id: int
    s_subj: float | None
    s_obj: float | None
    obj_available: bool
    w_raw: float | None
    w_prev: float | None
    smooth_alpha: float | None
    w_smooth: float | None
    floor_applied: bool
    w_adjusted: float | None
    w_final: float
    grade_code: str | None
    rank_no: int | None
    rank_pct: float | None
    coverage_score: float
    coverage_level: str
    gamma: float
    rater_count: int
    effective_n: float
    score_band: float | None
    covered_roles: list[str]
    missing_roles: list[str]
    is_frozen: bool
    is_carry_forward: bool
    adjust_summary: str | None
    blocks: list[BlockResult] = field(default_factory=list)
    rater_details: list[RaterDetail] = field(default_factory=list)
    adjust_traces: list[AdjustTrace] = field(default_factory=list)
