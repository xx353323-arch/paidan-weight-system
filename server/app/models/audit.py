from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_time", "created_at"),
        Index("ix_audit_target", "target_type", "target_id"),
        Index("ix_audit_actor", "actor_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)


class SysSetting(Base, TimestampMixin):
    __tablename__ = "sys_setting"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(String(16), default="string", nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
