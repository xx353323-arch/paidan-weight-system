from typing import Literal, get_args

from pydantic import BaseModel, Field, field_validator

TagColor = Literal[
    "blue",
    "purple",
    "green",
    "orange",
    "red",
    "cyan",
    "magenta",
    "gold",
    "lime",
    "volcano",
    "geekblue",
]

TAG_COLOR_VALUES = set(get_args(TagColor))


def _normalize_color(value: str | None) -> str | None:
    if value is not None and value not in TAG_COLOR_VALUES:
        raise ValueError("颜色只能从预设色板中选择")
    return value


def _normalize_name(value: str) -> str:
    text = value.strip()
    if not text:
        raise ValueError("标签名称不能为空")
    return text


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    color: TagColor = "blue"
    sortOrder: int = Field(0, ge=0, le=9999)

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("color", mode="before")
    @classmethod
    def check_color(cls, value: str | None) -> str | None:
        return _normalize_color(value)


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=30)
    color: TagColor | None = None
    sortOrder: int | None = Field(None, ge=0, le=9999)
    isActive: bool
    isGroup: bool | None = None

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str | None) -> str | None:
        return _normalize_name(value) if value is not None else None

    @field_validator("color", mode="before")
    @classmethod
    def check_color(cls, value: str | None) -> str | None:
        return _normalize_color(value)
