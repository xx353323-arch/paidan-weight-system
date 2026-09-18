from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EvalRelation(Base, TimestampMixin):
    __tablename__ = "eval_relation"
    __table_args__ = (
        Index(
            "uq_relation",
            "employee_id",
            "rater_user_id",
            "role_code",
            unique=True,
            sqlite_where=text("is_active = 1"),
        ),
        Index(
            "uq_relation_lead",
            "employee_id",
            unique=True,
            sqlite_where=text("is_active = 1 AND role_code = 'editor_lead'"),
        ),
        Index("ix_relation_rater", "rater_user_id", "is_active"),
        Index("ix_relation_emp", "employee_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    rater_user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id", ondelete="CASCADE"), nullable=False)
    role_code: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
