from dataclasses import dataclass
from typing import Any

from fastapi import Query


@dataclass
class PageParams:
    current: int = 1
    page_size: int = 20
    sorter: str | None = None
    keyword: str | None = None

    @property
    def offset(self) -> int:
        return max(0, (self.current - 1) * self.page_size)

    @property
    def limit(self) -> int:
        return max(1, min(self.page_size, 500))


def page_params(
    current: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=500),
    sorter: str | None = Query(None),
    keyword: str | None = Query(None),
) -> PageParams:
    return PageParams(current=current, page_size=pageSize, sorter=sorter, keyword=keyword)


def apply_sorter(stmt: Any, model: Any, sorter: str | None, field_map: dict[str, Any], default_order: Any):
    if not sorter:
        return stmt.order_by(default_order)
    parts = [p for p in sorter.split(",") if p]
    orders = []
    for part in parts:
        if ":" not in part:
            continue
        field, direction = part.split(":", 1)
        column = field_map.get(field)
        if column is None:
            continue
        orders.append(column.desc() if direction.startswith("desc") else column.asc())
    return stmt.order_by(*orders) if orders else stmt.order_by(default_order)
