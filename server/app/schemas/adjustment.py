from pydantic import BaseModel, Field


class AdjustmentCreate(BaseModel):
    employeeId: int
    adjustType: str
    value: float | None = None
    reason: str = Field(max_length=200)
    effectiveFromPeriodId: int
    effectiveToPeriodId: int | None = None


class AdjustmentRevoke(BaseModel):
    reason: str = Field(max_length=200)


class PreviewAdjustment(BaseModel):
    employeeId: int
    adjustType: str
    value: float | None = None


class AdjustmentPreview(BaseModel):
    periodId: int
    adjustments: list[PreviewAdjustment] = Field(default_factory=list)
