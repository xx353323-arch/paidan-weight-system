from app.engine.stats import clip
from app.engine.types import AdjustmentInput, AdjustTrace, AlgoParams

FREEZE = "FREEZE"
OVERRIDE = "OVERRIDE"
MULTIPLIER = "MULTIPLIER"
DELTA = "DELTA"


def apply_adjustments(
    base: float, adjustments: list[AdjustmentInput], params: AlgoParams
) -> tuple[float, bool, list[AdjustTrace], str | None]:
    traces: list[AdjustTrace] = []
    if not adjustments:
        return base, False, traces, None

    ordered = sorted(adjustments, key=lambda a: a.created_at_order)
    freezes = [a for a in ordered if a.adjust_type == FREEZE]
    overrides = [a for a in ordered if a.adjust_type == OVERRIDE]
    multipliers = [a for a in ordered if a.adjust_type == MULTIPLIER]
    deltas = [a for a in ordered if a.adjust_type == DELTA]

    order = 0
    if freezes:
        applied = freezes[-1]
        for item in ordered:
            order += 1
            effective = item is applied
            traces.append(
                AdjustTrace(
                    adjustment_id=item.adjustment_id,
                    adjust_type=item.adjust_type,
                    value_used=item.value,
                    value_before=base,
                    value_after=0.0 if effective else None,
                    was_effective=effective,
                    skip_reason=None if effective else "FREEZE_TAKES_PRECEDENCE",
                    apply_order=order,
                )
            )
        return 0.0, True, traces, "已冻结，退出派单池"

    if overrides:
        applied = overrides[-1]
        result = clip(applied.value or 0.0, params.weight_lower, params.weight_upper)
        for item in ordered:
            order += 1
            effective = item is applied
            traces.append(
                AdjustTrace(
                    adjustment_id=item.adjustment_id,
                    adjust_type=item.adjust_type,
                    value_used=item.value,
                    value_before=base,
                    value_after=result if effective else None,
                    was_effective=effective,
                    skip_reason=None if effective else "OVERRIDE_TAKES_PRECEDENCE",
                    apply_order=order,
                )
            )
        return result, False, traces, f"绝对覆盖为 {round(result, 2)} 分"

    current = base
    summary_parts = []
    for item in multipliers:
        order += 1
        before = current
        factor = item.value if item.value is not None else 1.0
        current = current * factor
        summary_parts.append(f"乘以 {factor}")
        traces.append(
            AdjustTrace(
                adjustment_id=item.adjustment_id,
                adjust_type=MULTIPLIER,
                value_used=factor,
                value_before=round(before, 4),
                value_after=round(current, 4),
                was_effective=True,
                skip_reason=None,
                apply_order=order,
            )
        )

    for item in deltas:
        order += 1
        before = current
        offset = item.value if item.value is not None else 0.0
        current = current + offset
        summary_parts.append(f"{'加' if offset >= 0 else '减'} {abs(offset)} 分")
        traces.append(
            AdjustTrace(
                adjustment_id=item.adjustment_id,
                adjust_type=DELTA,
                value_used=offset,
                value_before=round(before, 4),
                value_after=round(current, 4),
                was_effective=True,
                skip_reason=None,
                apply_order=order,
            )
        )

    summary = "，".join(summary_parts) if summary_parts else None
    return current, False, traces, summary
