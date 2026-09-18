from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class WeightAdjustment(Base, TimestampMixin):
    __tablename__ = "weight_adjustment"
    __table_args__ = (
        Index("ix_adj_emp", "employee_id", "status"),
        Index("ix_adj_from", "effective_from_period_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    adjust_type: Mapped[str] = mapped_column(String(16), nullable=False)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    effective_from_period_id: Mapped[int] = mapped_column(ForeignKey("eval_period.id"), nullable=False)
    effective_to_period_id: Mapped[int | None] = mapped_column(ForeignKey("eval_period.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class SnapshotAdjustmentLink(Base):
    __tablename__ = "snapshot_adjustment_link"
    __table_args__ = (Index("ix_link_snap", "snapshot_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("weight_snapshot.id", ondelete="CASCADE"), nullable=False)
    adjustment_id: Mapped[int] = mapped_column(ForeignKey("weight_adjustment.id"), nullable=False)
    apply_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    adjust_type: Mapped[str] = mapped_column(String(16), nullable=False)
    value_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    was_effective: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    skip_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
