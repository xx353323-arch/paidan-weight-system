from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.core.constants import EmploymentStatus

EMPLOYMENT_STATUS_VALUES = {item.value for item in EmploymentStatus}
BATCH_TAG_MODES = {"append", "replace"}


def _validate_status(value: str) -> str:
    if value not in EMPLOYMENT_STATUS_VALUES:
        raise ValueError("在职状态取值不合法")
    return value


class EmployeeCreate(BaseModel):
    empNo: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=50)
    employmentStatus: str = EmploymentStatus.REGULAR.value
    hiredAt: date | None = None
    remark: str | None = Field(default=None, max_length=500)
    leadUserId: int | None = None
    tagIds: list[int] = Field(default_factory=list)

    @field_validator("empNo", "name")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("不能为空")
        return cleaned

    @field_validator("employmentStatus")
    @classmethod
    def check_status(cls, value: str) -> str:
        return _validate_status(value)


class EmployeeUpdate(BaseModel):
    empNo: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, max_length=50)
    employmentStatus: str | None = None
    hiredAt: date | None = None
    remark: str | None = Field(default=None, max_length=500)
    leadUserId: int | None = None
    tagIds: list[int] | None = None

    @field_validator("empNo", "name")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("不能为空")
        return cleaned

    @field_validator("employmentStatus")
    @classmethod
    def check_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_status(value)


class EmployeeStatusUpdate(BaseModel):
    employmentStatus: str
    leftAt: date | None = None

    @field_validator("employmentStatus")
    @classmethod
    def check_status(cls, value: str) -> str:
        return _validate_status(value)


class EmployeeBatchTag(BaseModel):
    employeeIds: list[int] = Field(min_length=1)
    tagIds: list[int] = Field(default_factory=list)
    mode: str = "append"

    @field_validator("mode")
    @classmethod
    def check_mode(cls, value: str) -> str:
        if value not in BATCH_TAG_MODES:
            raise ValueError("打标签模式只能是 append 或 replace")
        return value
