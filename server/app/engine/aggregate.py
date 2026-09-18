from app.engine.stats import kish_effective_n, weighted_average
from app.engine.types import (
    AlgoParams,
    BlockResult,
    RaterDetail,
    RoleWeightConfig,
    SubmissionInput,
)

COVERAGE_LEVELS = [
    (0.80, "HIGH"),
    (0.60, "MEDIUM"),
    (0.30, "LOW"),
    (0.0001, "THIN"),
]


def coverage_level(omega: float) -> str:
    for threshold, label in COVERAGE_LEVELS:
        if omega >= threshold:
            return label
    return "NONE"


def merge_blocks(
    submissions: list[SubmissionInput],
    normalized: dict[int, tuple[float, float]],
    role_configs: list[RoleWeightConfig],
    params: AlgoParams,
) -> tuple[list[BlockResult], list[RaterDetail]]:
    by_role: dict[str, list[SubmissionInput]] = {}
    for s in submissions:
        by_role.setdefault(s.role_code, []).append(s)

    blocks: list[BlockResult] = []
    details: list[RaterDetail] = []

    for config in role_configs:
        rows = [s for s in by_role.get(config.role_code, []) if s.counted]
        weights = [s.familiarity_weight for s in rows]
        familiarity_sum = sum(weights)

        pairs = []
        for s in rows:
            norm, z = normalized.get(s.submission_id, (None, 0.0))
            if norm is None:
                continue
            pairs.append((s.familiarity_weight, norm))
            details.append(
                RaterDetail(
                    rater_user_id=s.rater_user_id,
                    rater_name=s.rater_name,
                    role_code=s.role_code,
                    familiarity_code=s.familiarity_code,
                    familiarity_weight=s.familiarity_weight,
                    raw_score=round(sum(i.weight * i.score for i in s.items) / sum(i.weight for i in s.items), 4)
                    if s.items and sum(i.weight for i in s.items) > 0
                    else 0.0,
                    z_value=round(z, 4),
                    norm_score=round(norm, 4),
                )
            )

        block_score = weighted_average(pairs)
        credibility = min(1.0, familiarity_sum / config.familiarity_full_sum) if config.familiarity_full_sum > 0 else 0.0
        blocks.append(
            BlockResult(
                role_code=config.role_code,
                block_score=round(block_score, 4) if block_score is not None else None,
                nominal_weight=config.weight,
                credibility=round(credibility, 4),
                applied_weight=0.0,
                rater_count=len(pairs),
                familiarity_sum=round(familiarity_sum, 4),
                effective_n=round(kish_effective_n(weights), 4),
                was_missing=block_score is None,
            )
        )

    return blocks, details


def compose_subjective(
    blocks: list[BlockResult],
    params: AlgoParams,
    prior: float,
) -> tuple[float, float, float]:
    omega = sum(b.nominal_weight * b.credibility for b in blocks if b.block_score is not None)

    if omega <= 0:
        for block in blocks:
            block.applied_weight = 0.0
        return prior, 0.0, 0.0

    numerator = 0.0
    for block in blocks:
        if block.block_score is None:
            block.applied_weight = 0.0
            continue
        share = block.nominal_weight * block.credibility
        block.applied_weight = round(share / omega, 4)
        numerator += share * block.block_score

    observed = numerator / omega
    gamma = min(1.0, omega / params.coverage_full_threshold) if params.coverage_full_threshold > 0 else 1.0
    s_subj = gamma * observed + (1 - gamma) * prior
    return s_subj, omega, gamma
