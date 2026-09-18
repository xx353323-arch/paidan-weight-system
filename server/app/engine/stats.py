from math import sqrt


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def sample_std(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    avg = mean(values)
    variance = sum((v - avg) ** 2 for v in values) / (n - 1)
    return sqrt(variance)


def clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def kish_effective_n(weights: list[float]) -> float:
    positive = [w for w in weights if w > 0]
    if not positive:
        return 0.0
    total = sum(positive)
    squared = sum(w * w for w in positive)
    return (total * total) / squared if squared else 0.0


def weighted_average(pairs: list[tuple[float, float]]) -> float | None:
    total_weight = sum(w for w, _ in pairs)
    if total_weight <= 0:
        return None
    return sum(w * v for w, v in pairs) / total_weight


def round4(value: float | None) -> float | None:
    return None if value is None else round(value, 4)
