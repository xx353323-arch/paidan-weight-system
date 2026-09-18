from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PeriodCreate(BaseModel):
    code: str = Field(pattern=r"^\d{4}-\d{2}$")
    openAt: datetime | None = None
    closeAt: datetime | None = None

    @field_validator("code")
    @classmethod
    def check_month(cls, value: str) -> str:
        month = int(value.split("-")[1])
        if month < 1 or month > 12:
            raise ValueError("月份必须在 01 到 12 之间")
        return value


class PeriodUpdate(BaseModel):
    openAt: datetime | None = None
    closeAt: datetime | None = None
