from math import sqrt

from app.engine.types import AlgoParams, GradeBandConfig, SnapshotResult


def assign_grade(value: float, bands: list[GradeBandConfig]) -> str | None:
    for band in sorted(bands, key=lambda b: -b.lower):
        if band.lower <= value <= band.upper:
            return band.code
    return bands[-1].code if bands else None


def score_band(effective_n: float, params: AlgoParams) -> float | None:
    if effective_n <= 0:
        return None
    return round(params.band_constant / sqrt(effective_n), 2)


def assign_ranks(snapshots: list[SnapshotResult]) -> None:
    rankable = [s for s in snapshots if not s.is_frozen]
    rankable.sort(
        key=lambda s: (-s.w_final, -s.coverage_score, -(s.w_raw or 0.0), s.employee_id)
    )
    total = len(rankable)
    previous_key = None
    previous_rank = 0
    for index, snapshot in enumerate(rankable, start=1):
        key = round(snapshot.w_final, 4)
        if previous_key is not None and key == previous_key:
            snapshot.rank_no = previous_rank
        else:
            snapshot.rank_no = index
            previous_rank = index
            previous_key = key
        snapshot.rank_pct = round(snapshot.rank_no / total, 4) if total else None
    for snapshot in snapshots:
        if snapshot.is_frozen:
            snapshot.rank_no = None
            snapshot.rank_pct = None
