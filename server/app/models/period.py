from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EvalPeriod(Base, TimestampMixin):
    __tablename__ = "eval_period"
    __table_args__ = (Index("ix_period_status", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(7), unique=True, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    open_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    close_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    config_id: Mapped[int | None] = mapped_column(ForeignKey("algo_config.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
