from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Employee(Base, TimestampMixin):
    __tablename__ = "employee"
    __table_args__ = (Index("ix_employee_status", "employment_status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    emp_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("sys_user.id"), nullable=True)
    employment_status: Mapped[str] = mapped_column(String(16), default="regular", nullable=False)
    hired_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    left_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    in_dispatch_pool: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    tags: Mapped[list["EmployeeTag"]] = relationship(back_populates="employee", cascade="all, delete-orphan")


class Tag(Base, TimestampMixin):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(16), default="blue", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class EmployeeTag(Base):
    __tablename__ = "employee_tag"
    __table_args__ = (Index("ix_employee_tag_tag", "tag_id"),)

    employee_id: Mapped[int] = mapped_column(ForeignKey("employee.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)

    employee: Mapped["Employee"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()
