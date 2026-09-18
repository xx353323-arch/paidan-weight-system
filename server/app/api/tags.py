from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import ErrorCode, ShowType
from app.core.deps import CurrentUser, get_current_user, require_admin, require_rater
from app.core.errors import BizError, NotFoundError
from app.core.response import ok
from app.db.session import get_db
from app.models import Employee, EmployeeTag, Tag
from app.schemas.tag import TagCreate, TagUpdate

router = APIRouter(tags=["标签"])


def _serialize(tag: Tag, employee_count: int) -> dict:
    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "sortOrder": tag.sort_order,
        "isActive": tag.is_active,
        "isGroup": tag.is_group,
        "employeeCount": employee_count,
    }


def _snapshot(tag: Tag) -> dict:
    return {
        "name": tag.name,
        "color": tag.color,
        "sortOrder": tag.sort_order,
        "isActive": tag.is_active,
        "isGroup": tag.is_group,
    }


def _tag_rows(db: Session) -> list[tuple[Tag, int]]:
    stmt = (
        select(Tag, func.count(Employee.id))
        .outerjoin(EmployeeTag, EmployeeTag.tag_id == Tag.id)
        .outerjoin(Employee, (Employee.id == EmployeeTag.employee_id) & (Employee.deleted_at.is_(None)))
        .group_by(Tag.id)
        .order_by(Tag.sort_order.asc(), Tag.id.asc())
    )
    return [(row[0], row[1]) for row in db.execute(stmt)]


def _employee_count(db: Session, tag_id: int) -> int:
    stmt = (
        select(func.count(Employee.id))
        .select_from(EmployeeTag)
        .join(Employee, Employee.id == EmployeeTag.employee_id)
        .where(EmployeeTag.tag_id == tag_id, Employee.deleted_at.is_(None))
    )
    return db.scalar(stmt) or 0


def _get_tag(db: Session, tag_id: int) -> Tag:
    tag = db.get(Tag, tag_id)
    if not tag:
        raise NotFoundError("标签不存在或已被删除")
    return tag


def _ensure_name_unique(db: Session, name: str, exclude_id: int | None = None) -> None:
    stmt = select(Tag.id).where(func.lower(Tag.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Tag.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise BizError(f"标签名称「{name}」已存在，请换一个", ErrorCode.VALIDATION, ShowType.WARN)


@router.get("/tags", summary="标签全量列表")
def list_tags(user: CurrentUser = Depends(require_rater), db: Session = Depends(get_db)):
    return ok([_serialize(tag, count) for tag, count in _tag_rows(db)])


@router.post("/tags", summary="新建标签")
def create_tag(payload: TagCreate, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    _ensure_name_unique(db, payload.name)
    tag = Tag(name=payload.name, color=payload.color, sort_order=payload.sortOrder, is_active=True)
    db.add(tag)
    db.flush()
    write_audit(db, admin, "TAG_CREATE", "tag", tag.id, f"新建标签 {tag.name}", after=_snapshot(tag))
    db.commit()
    return ok(_serialize(tag, 0))


@router.put("/tags/{tag_id}", summary="编辑标签")
def update_tag(tag_id: int, payload: TagUpdate, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    tag = _get_tag(db, tag_id)
    before = _snapshot(tag)
    if payload.name is not None and payload.name != tag.name:
        _ensure_name_unique(db, payload.name, exclude_id=tag.id)
        tag.name = payload.name
    if payload.color is not None:
        tag.color = payload.color
    if payload.sortOrder is not None:
        tag.sort_order = payload.sortOrder
    if payload.isActive is not None:
        tag.is_active = payload.isActive
    if payload.isGroup is not None:
        tag.is_group = payload.isGroup
    after = _snapshot(tag)
    write_audit(db, admin, "TAG_UPDATE", "tag", tag.id, f"编辑标签 {tag.name}", before=before, after=after)
    db.commit()
    return ok(_serialize(tag, _employee_count(db, tag.id)))


@router.delete("/tags/{tag_id}", summary="删除标签")
def delete_tag(tag_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    tag = _get_tag(db, tag_id)
    used = _employee_count(db, tag.id)
    if used > 0:
        raise BizError(
            f"该标签已被 {used} 名员工使用，无法删除，建议改为停用",
            ErrorCode.STATE_CONFLICT,
            ShowType.WARN,
            {"employeeCount": used, "tagId": tag.id, "name": tag.name},
        )
    before = _snapshot(tag)
    db.delete(tag)
    write_audit(db, admin, "TAG_DELETE", "tag", tag_id, f"删除标签 {before['name']}", before=before)
    db.commit()
    return ok(True)


@router.put("/tags/{tag_id}/toggle", summary="启用停用标签")
def toggle_tag(tag_id: int, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    tag = _get_tag(db, tag_id)
    before = _snapshot(tag)
    tag.is_active = not tag.is_active
    action_label = "启用" if tag.is_active else "停用"
    write_audit(db, admin, "TAG_TOGGLE", "tag", tag.id, f"{action_label}标签 {tag.name}", before=before, after=_snapshot(tag))
    db.commit()
    return ok(_serialize(tag, _employee_count(db, tag.id)))
