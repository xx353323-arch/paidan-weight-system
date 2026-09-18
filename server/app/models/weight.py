from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WeightRun(Base, TimestampMixin):
    __tablename__ = "weight_run"
    __table_args__ = (Index("uq_run", "period_id", "run_no", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("eval_period.id", ondelete="CASCADE"), nullable=False)
    run_no: Mapped[int] = mapped_column(Integer, nullable=False)
    run_type: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="running", nullable=False)
    config_id: Mapped[int | None] = mapped_column(ForeignKey("algo_config.id"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_by: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    stats_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WeightSnapshot(Base, TimestampMixin):
    __tablename__ = "weight_snapshot"
    __table_args__ = (
        Index("uq_snap", "run_id", "employee_id", unique=True),
        Index("ix_snap_rank", "period_id", "is_published", "w_final"),
        Index("ix_snap_emp", "employee_id", "period_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("weight_run.id", ondelete="CASCADE"), nullable=False)
    period_id: Mapped[int] = mapped_column(ForeignKey("eval_period.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    s_subj: Mapped[float | None] = mapped_column(Float, nullable=True)
    s_obj: Mapped[float | None] = mapped_column(Float, nullable=True)
    obj_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    w_raw: Mapped[float | None] = mapped_column(Float, nullable=True)
    w_prev: Mapped[float | None] = mapped_column(Float, nullable=True)
    smooth_alpha: Mapped[float | None] = mapped_column(Float, nullable=True)
    w_smooth: Mapped[float | None] = mapped_column(Float, nullable=True)
    floor_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    w_adjusted: Mapped[float | None] = mapped_column(Float, nullable=True)
    w_final: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    grade_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    rank_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rank_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    coverage_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    coverage_level: Mapped[str] = mapped_column(String(16), default="NONE", nullable=False)
    gamma: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rater_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    effective_n: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    score_band: Mapped[float | None] = mapped_column(Float, nullable=True)
    covered_roles: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_roles: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_frozen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_carry_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    adjust_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    blocks: Mapped[list["WeightRoleBlock"]] = relationship(back_populates="snapshot", cascade="all, delete-orphan")


class WeightRoleBlock(Base):
    __tablename__ = "weight_role_block"
    __table_args__ = (Index("ix_block_snap", "snapshot_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("weight_snapshot.id", ondelete="CASCADE"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(20), nullable=False)
    block_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    nominal_weight: Mapped[float] = mapped_column(Float, nullable=False)
    credibility: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    applied_weight: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rater_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    familiarity_sum: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    effective_n: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    was_missing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    snapshot: Mapped["WeightSnapshot"] = relationship(back_populates="blocks")


class WeightAlert(Base, TimestampMixin):
    __tablename__ = "weight_alert"
    __table_args__ = (Index("ix_alert_run", "run_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("weight_run.id", ondelete="CASCADE"), nullable=False)
    period_id: Mapped[int] = mapped_column(ForeignKey("eval_period.id", ondelete="CASCADE"), nullable=False)
    level: Mapped[str] = mapped_column(String(8), default="warn", nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employee.id"), nullable=True)
    rater_user_id: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
