from app.engine.stats import clip, mean, sample_std
from app.engine.types import AlertItem, AlgoParams, RaterStat, SubmissionInput


def item_weighted_score(submission: SubmissionInput) -> float:
    total_weight = sum(i.weight for i in submission.items)
    if total_weight <= 0:
        return 0.0
    return sum(i.weight * i.score for i in submission.items) / total_weight


def build_pool_stats(
    submissions: list[SubmissionInput],
    history: dict[str, list[float]] | None,
    params: AlgoParams,
) -> dict[str, tuple[float, float, int]]:
    by_role: dict[str, list[float]] = {}
    for s in submissions:
        if not s.counted:
            continue
        by_role.setdefault(s.role_code, []).append(item_weighted_score(s))

    pool: dict[str, tuple[float, float, int]] = {}
    for role_code, values in by_role.items():
        merged = list(values)
        if len(merged) < params.pool_min_count and history:
            merged.extend(history.get(role_code, []))
        pool[role_code] = (mean(merged), sample_std(merged), len(values))
    return pool


def build_rater_stats(
    submissions: list[SubmissionInput],
    params: AlgoParams,
    history: dict[str, list[float]] | None = None,
) -> tuple[dict[tuple[int, str], RaterStat], dict[str, tuple[float, float, int]], list[AlertItem]]:
    pool = build_pool_stats(submissions, history, params)
    alerts: list[AlertItem] = []

    grouped: dict[tuple[int, str], list[SubmissionInput]] = {}
    for s in submissions:
        if not s.counted:
            continue
        grouped.setdefault((s.rater_user_id, s.role_code), []).append(s)

    stats: dict[tuple[int, str], RaterStat] = {}
    for key, rows in grouped.items():
        rater_user_id, role_code = key
        values = [item_weighted_score(r) for r in rows]
        n = len(values)
        mu = mean(values)
        sigma = sample_std(values)
        pool_mu, pool_sigma, _ = pool.get(role_code, (mu, sigma, n))

        lam = n / (n + params.z_shrink_k) if n >= params.z_min_n else 0.0
        mu_hat = lam * mu + (1 - lam) * pool_mu
        sigma_hat = max(lam * sigma + (1 - lam) * pool_sigma, params.z_sigma_floor)

        low_variance = n >= 5 and sigma < params.alert_low_sigma
        if low_variance:
            alerts.append(
                AlertItem(
                    level="warn",
                    code="RATER_LOW_VARIANCE",
                    message=f"{rows[0].rater_name} 本期对 {n} 人的打分区分度不足，标准差仅 {round(sigma, 3)}",
                    rater_user_id=rater_user_id,
                )
            )

        stats[key] = RaterStat(
            rater_user_id=rater_user_id,
            role_code=role_code,
            n=n,
            mean=round(mu, 4),
            std=round(sigma, 4),
            lam=round(lam, 4),
            mu_hat=round(mu_hat, 4),
            sigma_hat=round(sigma_hat, 4),
            low_variance=low_variance,
        )

    for role_code, (_, pool_sigma, count) in pool.items():
        if count >= 2 and pool_sigma < params.alert_low_sigma:
            alerts.append(
                AlertItem(
                    level="error",
                    code="BLOCK_NO_DISCRIMINATION",
                    message=f"{role_code} 维度全体打分几乎相同，标准差仅 {round(pool_sigma, 3)}，本维度已退化为绝对分",
                )
            )

    return stats, pool, alerts


def normalize_score(
    raw: float,
    stat: RaterStat | None,
    pool: tuple[float, float, int] | None,
    params: AlgoParams,
) -> tuple[float, float]:
    s_abs = params.abs_base + params.abs_step * (raw - 1)

    if pool is None or pool[2] < 2 or pool[1] < params.z_sigma_floor:
        return clip(s_abs, params.score_clip_low, params.score_clip_high), 0.0

    if stat is None or stat.sigma_hat <= 0:
        return clip(s_abs, params.score_clip_low, params.score_clip_high), 0.0

    z = (raw - stat.mu_hat) / stat.sigma_hat
    s_z = params.score_center + params.score_scale * z
    blended = params.z_blend_beta * s_z + (1 - params.z_blend_beta) * s_abs
    return clip(blended, params.score_clip_low, params.score_clip_high), z
