from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AlgoConfig(Base, TimestampMixin):
    __tablename__ = "algo_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    score_center: Mapped[float] = mapped_column(Float, default=75.0, nullable=False)
    score_scale: Mapped[float] = mapped_column(Float, default=8.0, nullable=False)
    score_clip_low: Mapped[float] = mapped_column(Float, default=30.0, nullable=False)
    score_clip_high: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    z_min_n: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    z_shrink_k: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    z_sigma_floor: Mapped[float] = mapped_column(Float, default=0.30, nullable=False)
    z_blend_beta: Mapped[float] = mapped_column(Float, default=0.70, nullable=False)
    abs_base: Mapped[float] = mapped_column(Float, default=40.0, nullable=False)
    abs_step: Mapped[float] = mapped_column(Float, default=15.0, nullable=False)
    pool_min_count: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    coverage_full_threshold: Mapped[float] = mapped_column(Float, default=0.60, nullable=False)
    require_lead_block: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    objective_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subj_weight: Mapped[float] = mapped_column(Float, default=0.60, nullable=False)
    obj_weight: Mapped[float] = mapped_column(Float, default=0.40, nullable=False)
    smooth_alpha_json: Mapped[str] = mapped_column(Text, default="[1.0, 0.85, 0.70]", nullable=False)
    newcomer_protect_periods: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    newcomer_floor: Mapped[float] = mapped_column(Float, default=65.0, nullable=False)
    newcomer_prior: Mapped[float] = mapped_column(Float, default=75.0, nullable=False)
    weight_lower: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    weight_upper: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    band_constant: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    alert_jump_threshold: Mapped[float] = mapped_column(Float, default=15.0, nullable=False)
    alert_low_sigma: Mapped[float] = mapped_column(Float, default=0.30, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConfigRoleWeight(Base):
    __tablename__ = "config_role_weight"
    __table_args__ = (Index("uq_role_weight", "config_id", "role_code", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("algo_config.id", ondelete="CASCADE"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    familiarity_full_sum: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ConfigItem(Base):
    __tablename__ = "config_item"
    __table_args__ = (
        Index("ix_config_item", "config_id", "role_code", "sort_order"),
        Index("uq_config_item", "config_id", "role_code", "code", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("algo_config.id", ondelete="CASCADE"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    anchor_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    comment_required_below: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ConfigFamiliarity(Base):
    __tablename__ = "config_familiarity"
    __table_args__ = (Index("uq_familiarity", "config_id", "code", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("algo_config.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    label: Mapped[str] = mapped_column(String(30), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    is_unknown: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ConfigGradeBand(Base):
    __tablename__ = "config_grade_band"
    __table_args__ = (Index("uq_grade", "config_id", "code", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("algo_config.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(8), nullable=False)
    label: Mapped[str] = mapped_column(String(30), nullable=False)
    lower: Mapped[float] = mapped_column(Float, nullable=False)
    upper: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[str] = mapped_column(String(16), default="default", nullable=False)
    policy_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
