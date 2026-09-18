from pydantic import BaseModel, Field

from app.core.constants import CoverageMode


class TargetSaveRequest(BaseModel):
    roleCode: str | None = None
    targetIds: list[int] = Field(default_factory=list)
    coverageMode: str = CoverageMode.EXPLICIT


class CopyFromLastRequest(BaseModel):
    confirm: bool = True
