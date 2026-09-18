from app.engine.stats import clip
from app.engine.types import AlgoParams, EmployeeContext


def pick_alpha(published_periods: int, params: AlgoParams) -> float:
    if not params.smooth_alpha:
        return 1.0
    index = min(published_periods, len(params.smooth_alpha) - 1)
    return params.smooth_alpha[index]


def smooth_score(w_raw: float, context: EmployeeContext, params: AlgoParams) -> tuple[float, float]:
    alpha = pick_alpha(context.published_periods, params)
    if context.prev_final is None:
        return w_raw, 1.0
    return alpha * w_raw + (1 - alpha) * context.prev_final, alpha


def apply_newcomer_floor(
    value: float, context: EmployeeContext, params: AlgoParams
) -> tuple[float, bool]:
    if context.tenure_months is None:
        return value, False
    protected = context.tenure_months <= params.newcomer_protect_periods
    active = context.employment_status in ("probation", "regular")
    if protected and active and value < params.newcomer_floor:
        return params.newcomer_floor, True
    return value, False


def compose_raw(s_subj: float, s_obj: float | None, params: AlgoParams) -> tuple[float, bool]:
    if params.objective_enabled and s_obj is not None:
        theta = params.obj_weight
        return (1 - theta) * s_subj + theta * s_obj, True
    return s_subj, False


def finalize(value: float, params: AlgoParams) -> float:
    return clip(value, params.weight_lower, params.weight_upper)
