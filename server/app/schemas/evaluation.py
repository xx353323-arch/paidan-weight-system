from typing import Any

from pydantic import BaseModel, Field


class EvalRecordInput(BaseModel):
    employeeId: int
    familiarityCode: str | None = None
    scores: dict[str, Any] = Field(default_factory=dict)
    comments: dict[str, Any] = Field(default_factory=dict)
    overallComment: str | None = None


class DraftSaveRequest(BaseModel):
    periodId: int | None = None
    records: list[EvalRecordInput] = Field(default_factory=list)


class SubmitRequest(BaseModel):
    periodId: int | None = None
    records: list[EvalRecordInput] = Field(default_factory=list)


class UnknownRequest(BaseModel):
    periodId: int | None = None
    employeeIds: list[int] = Field(default_factory=list)
    reason: str | None = None


class WithdrawRequest(BaseModel):
    periodId: int | None = None
    employeeIds: list[int] = Field(default_factory=list)
