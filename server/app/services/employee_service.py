from datetime import date

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.audit import write_audit
from app.core.constants import ACTIVE_EMPLOYMENT, EmploymentStatus, ErrorCode, RoleCode
from app.core.deps import CurrentUser
from app.core.errors import BizError, NotFoundError
from app.db.base import now
from app.models import Employee, EmployeeTag, EvalRelation, SysUser, SysUserRole, Tag
from app.schemas.employee import EmployeeBatchTag, EmployeeCreate, EmployeeStatusUpdate, EmployeeUpdate
from app.utils.pagination import PageParams, apply_sorter

ACTIVE_EMPLOYMENT_VALUES = [item.value for item in ACTIVE_EMPLOYMENT]


def parse_id_list(raw: str | None) -> list[int]:
    if not raw:
        return []
    values = []
    for part in str(raw).split(","):
        item = part.strip()
        if item.isdigit():
            values.append(int(item))
    return values


def _load_employee(db: Session, employee_id: int) -> Employee:
    employee = db.get(Employee, employee_id)
    if not employee or employee.deleted_at is not None:
        raise NotFoundError("员工不存在")
    return employee


def _sync_employment_flags(employee: Employee, status: str, left_at: date | None) -> None:
    employee.employment_status = status
    if status == EmploymentStatus.LEFT.value:
        employee.left_at = left_at or employee.left_at or date.today()
        employee.in_dispatch_pool = False
    else:
        employee.left_at = left_at
        employee.in_dispatch_pool = status in ACTIVE_EMPLOYMENT_VALUES


def _lead_map(db: Session, employee_ids: list[int]) -> dict[int, tuple[int, str]]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EvalRelation.employee_id, EvalRelation.rater_user_id, SysUser.display_name)
        .join(SysUser, SysUser.id == EvalRelation.rater_user_id)
        .where(
            EvalRelation.employee_id.in_(employee_ids),
            EvalRelation.role_code == RoleCode.EDITOR_LEAD.value,
            EvalRelation.is_active.is_(True),
        )
    ).all()
    return {row[0]: (row[1], row[2]) for row in rows}


def _tag_map(db: Session, employee_ids: list[int]) -> dict[int, list[dict]]:
    result: dict[int, list[dict]] = {}
    if not employee_ids:
        return result
    rows = db.execute(
        select(EmployeeTag.employee_id, Tag.id, Tag.name, Tag.color)
        .join(Tag, Tag.id == EmployeeTag.tag_id)
        .where(EmployeeTag.employee_id.in_(employee_ids))
        .order_by(Tag.sort_order.asc(), Tag.id.asc())
    ).all()
    for employee_id, tag_id, tag_name, tag_color in rows:
        result.setdefault(employee_id, []).append({"id": tag_id, "name": tag_name, "color": tag_color})
    return result


def _serialize(employee: Employee, username: str | None, lead: tuple[int, str] | None, tags: list[dict]) -> dict:
    return {
        "id": employee.id,
        "empNo": employee.emp_no,
        "name": employee.name,
        "employmentStatus": employee.employment_status,
        "hiredAt": employee.hired_at.isoformat() if employee.hired_at else None,
        "leftAt": employee.left_at.isoformat() if employee.left_at else None,
        "inDispatchPool": bool(employee.in_dispatch_pool),
        "remark": employee.remark,
        "leadUserId": lead[0] if lead else None,
        "leadName": lead[1] if lead else None,
        "tags": tags,
        "username": username,
    }


def list_employees(
    db: Session,
    params: PageParams,
    employment_status: str | None = None,
    tag_ids: list[int] | None = None,
    lead_user_id: int | None = None,
) -> tuple[list[dict], int]:
    account = aliased(SysUser)
    lead_relation = aliased(EvalRelation)

    stmt = (
        select(Employee, account.username)
        .outerjoin(account, account.id == Employee.user_id)
        .where(Employee.deleted_at.is_(None))
    )

    if params.keyword:
        pattern = f"%{params.keyword.strip()}%"
        stmt = stmt.where(or_(Employee.name.like(pattern), Employee.emp_no.like(pattern)))
    if employment_status:
        stmt = stmt.where(Employee.employment_status == employment_status)
    if tag_ids:
        stmt = stmt.where(
            Employee.id.in_(select(EmployeeTag.employee_id).where(EmployeeTag.tag_id.in_(tag_ids)))
        )
    if lead_user_id:
        stmt = stmt.where(
            Employee.id.in_(
                select(lead_relation.employee_id).where(
                    lead_relation.rater_user_id == lead_user_id,
                    lead_relation.role_code == RoleCode.EDITOR_LEAD.value,
                    lead_relation.is_active.is_(True),
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    field_map = {
        "empNo": Employee.emp_no,
        "name": Employee.name,
        "employmentStatus": Employee.employment_status,
        "hiredAt": Employee.hired_at,
        "createdAt": Employee.created_at,
    }
    stmt = apply_sorter(stmt, Employee, params.sorter, field_map, Employee.emp_no.asc())
    rows = db.execute(stmt.offset(params.offset).limit(params.limit)).all()

    employee_ids = [row[0].id for row in rows]
    leads = _lead_map(db, employee_ids)
    tags = _tag_map(db, employee_ids)
    items = [_serialize(row[0], row[1], leads.get(row[0].id), tags.get(row[0].id, [])) for row in rows]
    return items, total


def employee_options(db: Session) -> list[dict]:
    rows = db.execute(
        select(Employee.id, Employee.name, Employee.emp_no)
        .where(Employee.deleted_at.is_(None), Employee.employment_status.in_(ACTIVE_EMPLOYMENT_VALUES))
        .order_by(Employee.emp_no.asc())
    ).all()
    return [{"value": row[0], "label": row[1], "empNo": row[2]} for row in rows]


def lead_options(db: Session) -> list[dict]:
    rows = db.execute(
        select(SysUser.id, SysUser.display_name)
        .join(SysUserRole, SysUserRole.user_id == SysUser.id)
        .where(
            SysUserRole.role_code == RoleCode.EDITOR_LEAD.value,
            SysUser.deleted_at.is_(None),
            SysUser.status == "active",
        )
        .order_by(SysUser.id.asc())
    ).all()
    return [{"value": row[0], "label": row[1]} for row in rows]


def _existing_tag_ids(db: Session, tag_ids: list[int]) -> list[int]:
    if not tag_ids:
        return []
    unique_ids = list(dict.fromkeys(tag_ids))
    found = set(db.scalars(select(Tag.id).where(Tag.id.in_(unique_ids))).all())
    missing = [str(item) for item in unique_ids if item not in found]
    if missing:
        raise BizError(f"标签不存在：{'、'.join(missing)}")
    return [item for item in unique_ids if item in found]


def _replace_tags(db: Session, employee_id: int, tag_ids: list[int]) -> None:
    valid_ids = _existing_tag_ids(db, tag_ids)
    db.execute(delete(EmployeeTag).where(EmployeeTag.employee_id == employee_id))
    db.flush()
    for tag_id in valid_ids:
        db.add(EmployeeTag(employee_id=employee_id, tag_id=tag_id))
    db.flush()


def _current_lead(db: Session, employee_id: int) -> EvalRelation | None:
    return db.scalar(
        select(EvalRelation).where(
            EvalRelation.employee_id == employee_id,
            EvalRelation.role_code == RoleCode.EDITOR_LEAD.value,
            EvalRelation.is_active.is_(True),
        )
    )


def _apply_lead(db: Session, employee_id: int, lead_user_id: int | None) -> None:
    if lead_user_id is not None:
        lead = db.get(SysUser, lead_user_id)
        if not lead or lead.deleted_at is not None:
            raise NotFoundError("直属主管账号不存在")

    actives = db.scalars(
        select(EvalRelation).where(
            EvalRelation.employee_id == employee_id,
            EvalRelation.role_code == RoleCode.EDITOR_LEAD.value,
            EvalRelation.is_active.is_(True),
        )
    ).all()
    kept = next((item for item in actives if item.rater_user_id == lead_user_id), None) if lead_user_id else None
    for relation in actives:
        if kept is not None and relation.id == kept.id:
            continue
        relation.is_active = False
        relation.effective_to = date.today()
    db.flush()

    if lead_user_id is not None and kept is None:
        db.add(
            EvalRelation(
                employee_id=employee_id,
                rater_user_id=lead_user_id,
                role_code=RoleCode.EDITOR_LEAD.value,
                source="manual",
                is_active=True,
                effective_from=date.today(),
            )
        )
        db.flush()


def _lead_name(db: Session, lead_user_id: int | None) -> str | None:
    if not lead_user_id:
        return None
    user = db.get(SysUser, lead_user_id)
    return user.display_name if user else None


def create_employee(db: Session, payload: EmployeeCreate, actor: CurrentUser) -> dict:
    duplicated = db.scalar(select(Employee).where(Employee.emp_no == payload.empNo))
    if duplicated:
        raise BizError(f"工号 {payload.empNo} 已被 {duplicated.name} 占用，请更换", ErrorCode.STATE_CONFLICT)

    employee = Employee(
        emp_no=payload.empNo,
        name=payload.name,
        hired_at=payload.hiredAt,
        remark=payload.remark,
    )
    _sync_employment_flags(employee, payload.employmentStatus, None)
    db.add(employee)
    db.flush()

    _apply_lead(db, employee.id, payload.leadUserId)
    if payload.tagIds:
        _replace_tags(db, employee.id, payload.tagIds)

    write_audit(
        db,
        actor,
        "EMPLOYEE_CREATE",
        "employee",
        employee.id,
        f"新建员工 {employee.name}（{employee.emp_no}）",
        after={
            "empNo": employee.emp_no,
            "name": employee.name,
            "employmentStatus": employee.employment_status,
            "leadUserId": payload.leadUserId,
            "tagIds": payload.tagIds,
        },
    )
    db.commit()
    db.refresh(employee)
    return _serialize(
        employee,
        None,
        (payload.leadUserId, _lead_name(db, payload.leadUserId)) if payload.leadUserId else None,
        _tag_map(db, [employee.id]).get(employee.id, []),
    )


def update_employee(db: Session, employee_id: int, payload: EmployeeUpdate, actor: CurrentUser) -> dict:
    employee = _load_employee(db, employee_id)
    touched = payload.model_fields_set
    lead_before = _current_lead(db, employee.id)
    before = {
        "empNo": employee.emp_no,
        "name": employee.name,
        "employmentStatus": employee.employment_status,
        "hiredAt": employee.hired_at.isoformat() if employee.hired_at else None,
        "leftAt": employee.left_at.isoformat() if employee.left_at else None,
        "inDispatchPool": bool(employee.in_dispatch_pool),
        "remark": employee.remark,
        "leadUserId": lead_before.rater_user_id if lead_before else None,
    }

    if "empNo" in touched and payload.empNo and payload.empNo != employee.emp_no:
        duplicated = db.scalar(select(Employee).where(Employee.emp_no == payload.empNo, Employee.id != employee.id))
        if duplicated:
            raise BizError(f"工号 {payload.empNo} 已被 {duplicated.name} 占用，请更换", ErrorCode.STATE_CONFLICT)
        employee.emp_no = payload.empNo
    if "name" in touched and payload.name:
        employee.name = payload.name
    if "employmentStatus" in touched and payload.employmentStatus:
        _sync_employment_flags(employee, payload.employmentStatus, None)
    if "hiredAt" in touched:
        employee.hired_at = payload.hiredAt
    if "remark" in touched:
        employee.remark = payload.remark
    if "leadUserId" in touched:
        _apply_lead(db, employee.id, payload.leadUserId)
    if "tagIds" in touched and payload.tagIds is not None:
        _replace_tags(db, employee.id, payload.tagIds)

    employee.updated_at = now()
    lead_after = _current_lead(db, employee.id)
    write_audit(
        db,
        actor,
        "EMPLOYEE_UPDATE",
        "employee",
        employee.id,
        f"编辑员工 {employee.name}（{employee.emp_no}）",
        before=before,
        after={
            "empNo": employee.emp_no,
            "name": employee.name,
            "employmentStatus": employee.employment_status,
            "hiredAt": employee.hired_at.isoformat() if employee.hired_at else None,
            "leftAt": employee.left_at.isoformat() if employee.left_at else None,
            "inDispatchPool": bool(employee.in_dispatch_pool),
            "remark": employee.remark,
            "leadUserId": lead_after.rater_user_id if lead_after else None,
        },
    )
    db.commit()
    db.refresh(employee)

    account = db.get(SysUser, employee.user_id) if employee.user_id else None
    lead = _lead_map(db, [employee.id]).get(employee.id)
    return _serialize(employee, account.username if account else None, lead, _tag_map(db, [employee.id]).get(employee.id, []))


def update_status(db: Session, employee_id: int, payload: EmployeeStatusUpdate, actor: CurrentUser) -> dict:
    employee = _load_employee(db, employee_id)
    before = {
        "employmentStatus": employee.employment_status,
        "leftAt": employee.left_at.isoformat() if employee.left_at else None,
        "inDispatchPool": bool(employee.in_dispatch_pool),
    }

    _sync_employment_flags(employee, payload.employmentStatus, payload.leftAt)
    employee.updated_at = now()

    write_audit(
        db,
        actor,
        "EMPLOYEE_STATUS",
        "employee",
        employee.id,
        f"{employee.name}（{employee.emp_no}）在职状态变更为 {payload.employmentStatus}",
        before=before,
        after={
            "employmentStatus": employee.employment_status,
            "leftAt": employee.left_at.isoformat() if employee.left_at else None,
            "inDispatchPool": bool(employee.in_dispatch_pool),
        },
    )
    db.commit()
    db.refresh(employee)

    account = db.get(SysUser, employee.user_id) if employee.user_id else None
    lead = _lead_map(db, [employee.id]).get(employee.id)
    return _serialize(employee, account.username if account else None, lead, _tag_map(db, [employee.id]).get(employee.id, []))


def batch_tag(db: Session, payload: EmployeeBatchTag, actor: CurrentUser) -> dict:
    employees = db.scalars(
        select(Employee).where(Employee.id.in_(payload.employeeIds), Employee.deleted_at.is_(None))
    ).all()
    if not employees:
        raise NotFoundError("未找到可操作的员工")

    valid_ids = _existing_tag_ids(db, payload.tagIds)
    employee_ids = [item.id for item in employees]

    if payload.mode == "replace":
        db.execute(delete(EmployeeTag).where(EmployeeTag.employee_id.in_(employee_ids)))
        db.flush()
        owned: set[tuple[int, int]] = set()
    else:
        owned = {
            (row[0], row[1])
            for row in db.execute(
                select(EmployeeTag.employee_id, EmployeeTag.tag_id).where(
                    EmployeeTag.employee_id.in_(employee_ids)
                )
            )
        }
    db.add_all(
        [
            EmployeeTag(employee_id=employee_id, tag_id=tag_id)
            for employee_id in employee_ids
            for tag_id in valid_ids
            if (employee_id, tag_id) not in owned
        ]
    )
    db.flush()

    names = "、".join(item.name for item in employees)
    write_audit(
        db,
        actor,
        "EMPLOYEE_BATCH_TAG",
        "employee",
        employees[0].id,
        f"批量{'覆盖' if payload.mode == 'replace' else '追加'}标签，涉及 {len(employees)} 人：{names}",
        after={"employeeIds": employee_ids, "tagIds": valid_ids, "mode": payload.mode},
    )
    db.commit()
    return {"updated": len(employees), "mode": payload.mode, "tagIds": valid_ids}
