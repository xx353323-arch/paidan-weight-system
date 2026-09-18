from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class EvalSubmission(Base, TimestampMixin):
    __tablename__ = "eval_submission"
    __table_args__ = (
        Index("uq_submission", "period_id", "employee_id", "rater_user_id", "role_code", unique=True),
        Index("ix_submission_rater", "period_id", "rater_user_id", "status"),
        Index("ix_submission_emp", "period_id", "employee_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("eval_period.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    rater_user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id", ondelete="CASCADE"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="relation", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="PENDING", nullable=False)
    familiarity_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    familiarity_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    unknown_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    norm_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    item_scores: Mapped[list["EvalItemScore"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class EvalItemScore(Base):
    __tablename__ = "eval_item_score"
    __table_args__ = (
        Index("uq_item", "submission_id", "item_code", unique=True),
        CheckConstraint("score >= 1 AND score <= 5", name="ck_item_score_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("eval_submission.id", ondelete="CASCADE"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(32), nullable=False)
    item_label: Mapped[str] = mapped_column(String(50), nullable=False)
    item_weight: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    submission: Mapped["EvalSubmission"] = relationship(back_populates="item_scores")
