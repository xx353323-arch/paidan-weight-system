from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import (
    ACTIVE_EMPLOYMENT,
    RATER_ROLES,
    ROLE_LABELS,
    CoverageMode,
    ErrorCode,
    RoleCode,
    ShowType,
)
from app.core.deps import CurrentUser
from app.core.errors import BizError, NotFoundError
from app.models import (
    AlgoConfig,
    ConfigRoleWeight,
    Employee,
    EmployeeTag,
    EvalPeriod,
    EvalRelation,
    EvalSubmission,
    RaterProfile,
    SysRole,
    SysUser,
    SysUserRole,
    Tag,
)


def _role_sort_map(db: Session) -> dict[str, int]:
    rows = db.execute(select(SysRole.code, SysRole.sort_order)).all()
    return {code: order for code, order in rows}


def _active_employees(db: Session) -> list[Employee]:
    stmt = (
        select(Employee)
        .where(Employee.deleted_at.is_(None), Employee.employment_status.in_(ACTIVE_EMPLOYMENT))
        .order_by(Employee.emp_no)
    )
    return list(db.scalars(stmt))


def _tag_map(db: Session) -> dict[int, list[dict]]:
    rows = db.execute(
        select(EmployeeTag.employee_id, Tag.id, Tag.name, Tag.color, Tag.sort_order)
        .join(Tag, Tag.id == EmployeeTag.tag_id)
        .order_by(Tag.sort_order, Tag.id)
    ).all()
    result: dict[int, list[dict]] = {}
    for employee_id, tag_id, name, color, _ in rows:
        result.setdefault(employee_id, []).append({"id": tag_id, "name": name, "color": color})
    return result


def _lead_map(db: Session) -> dict[int, dict]:
    rows = db.execute(
        select(EvalRelation.employee_id, SysUser.id, SysUser.display_name)
        .join(SysUser, SysUser.id == EvalRelation.rater_user_id)
        .where(EvalRelation.is_active.is_(True), EvalRelation.role_code == RoleCode.EDITOR_LEAD)
    ).all()
    return {employee_id: {"userId": user_id, "name": name} for employee_id, user_id, name in rows}


def _employee_rows(db: Session) -> list[dict]:
    employees = _active_employees(db)
    tags = _tag_map(db)
    leads = _lead_map(db)
    rows = []
    for item in employees:
        lead = leads.get(item.id)
        rows.append(
            {
                "id": item.id,
                "empNo": item.emp_no,
                "name": item.name,
                "employmentStatus": item.employment_status,
                "tags": tags.get(item.id, []),
                "leadUserId": lead["userId"] if lead else None,
                "leadName": lead["name"] if lead else None,
            }
        )
    return rows


def _role_weights(db: Session) -> list[dict]:
    config = db.scalar(
        select(AlgoConfig).where(AlgoConfig.status == "active").order_by(AlgoConfig.version_no.desc())
    )
    if config is None:
        config = db.scalar(select(AlgoConfig).order_by(AlgoConfig.version_no.desc()))
    if config is None:
        return []
    rows = db.scalars(
        select(ConfigRoleWeight)
        .where(ConfigRoleWeight.config_id == config.id)
        .order_by(ConfigRoleWeight.sort_order, ConfigRoleWeight.id)
    ).all()
    return [
        {
            "roleCode": row.role_code,
            "label": row.label,
            "weight": row.weight,
            "isMandatory": bool(row.is_mandatory),
        }
        for row in rows
    ]


def _rater_pairs(db: Session) -> list[tuple[SysUser, str]]:
    rows = db.execute(
        select(SysUser, SysUserRole.role_code)
        .join(SysUserRole, SysUserRole.user_id == SysUser.id)
        .where(SysUser.deleted_at.is_(None), SysUserRole.role_code.in_(RATER_ROLES))
    ).all()
    order = _role_sort_map(db)
    pairs = [(user, role_code) for user, role_code in rows]
    pairs.sort(key=lambda item: (order.get(item[1], 99), item[0].id))
    return pairs


def _profile_map(db: Session) -> dict[tuple[int, str], RaterProfile]:
    profiles = db.scalars(select(RaterProfile)).all()
    return {(item.user_id, item.role_code): item for item in profiles}


def _explicit_counts(db: Session) -> dict[tuple[int, str], int]:
    rows = db.execute(
        select(EvalRelation.rater_user_id, EvalRelation.role_code, func.count(EvalRelation.id))
        .join(Employee, Employee.id == EvalRelation.employee_id)
        .where(
            EvalRelation.is_active.is_(True),
            Employee.deleted_at.is_(None),
            Employee.employment_status.in_(ACTIVE_EMPLOYMENT),
        )
        .group_by(EvalRelation.rater_user_id, EvalRelation.role_code)
    ).all()
    return {(rater_user_id, role_code): total for rater_user_id, role_code, total in rows}


def list_raters(db: Session, employee_total: int | None = None) -> list[dict]:
    pairs = _rater_pairs(db)
    profiles = _profile_map(db)
    counts = _explicit_counts(db)
    if employee_total is None:
        employee_total = len(_active_employees(db))
    result = []
    for user, role_code in pairs:
        profile = profiles.get((user.id, role_code))
        coverage_mode = profile.coverage_mode if profile else CoverageMode.EXPLICIT
        is_active = bool(profile.is_active) if profile else True
        target_count = employee_total if coverage_mode == CoverageMode.ALL else counts.get((user.id, role_code), 0)
        result.append(
            {
                "userId": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "roleCode": role_code,
                "roleLabel": ROLE_LABELS.get(role_code, role_code),
                "coverageMode": coverage_mode,
                "isActive": is_active and user.status == "active",
                "targetCount": target_count,
            }
        )
    return result


def _resolve_role(db: Session, rater_user_id: int, role_code: str | None) -> tuple[SysUser, str]:
    user = db.get(SysUser, rater_user_id)
    if user is None or user.deleted_at is not None:
        raise NotFoundError("评价人不存在")
    roles = [
        item
        for item in db.scalars(select(SysUserRole.role_code).where(SysUserRole.user_id == rater_user_id))
        if item in RATER_ROLES
    ]
    if not roles:
        raise BizError(f"{user.display_name} 没有评价角色，无法配置评价关系")
    if role_code is None:
        if len(roles) > 1:
            raise BizError(f"{user.display_name} 拥有多个评价角色，请指定 roleCode")
        return user, roles[0]
    if role_code not in roles:
        raise BizError(f"{user.display_name} 不具备 {ROLE_LABELS.get(role_code, role_code)} 角色")
    return user, role_code


def _ensure_profile(db: Session, user_id: int, role_code: str) -> RaterProfile:
    profile = db.scalar(
        select(RaterProfile).where(RaterProfile.user_id == user_id, RaterProfile.role_code == role_code)
    )
    if profile is None:
        profile = RaterProfile(user_id=user_id, role_code=role_code, coverage_mode=CoverageMode.EXPLICIT)
        db.add(profile)
        db.flush()
    return profile


def get_targets(db: Session, rater_user_id: int, role_code: str | None) -> dict:
    user, resolved_role = _resolve_role(db, rater_user_id, role_code)
    profile = db.scalar(
        select(RaterProfile).where(RaterProfile.user_id == user.id, RaterProfile.role_code == resolved_role)
    )
    coverage_mode = profile.coverage_mode if profile else CoverageMode.EXPLICIT
    employees = _employee_rows(db)
    valid_ids = {item["id"] for item in employees}
    target_ids = [
        employee_id
        for employee_id in db.scalars(
            select(EvalRelation.employee_id).where(
                EvalRelation.rater_user_id == user.id,
                EvalRelation.role_code == resolved_role,
                EvalRelation.is_active.is_(True),
            )
        )
        if employee_id in valid_ids
    ]
    return {
        "raterUserId": user.id,
        "displayName": user.display_name,
        "roleCode": resolved_role,
        "roleLabel": ROLE_LABELS.get(resolved_role, resolved_role),
        "coverageMode": coverage_mode,
        "targetIds": target_ids,
        "employees": employees,
    }


def _lead_conflicts(db: Session, rater_user_id: int, target_ids: list[int]) -> list[dict]:
    if not target_ids:
        return []
    rows = db.execute(
        select(Employee.id, Employee.name, Employee.emp_no, SysUser.id, SysUser.display_name)
        .join(EvalRelation, EvalRelation.employee_id == Employee.id)
        .join(SysUser, SysUser.id == EvalRelation.rater_user_id)
        .where(
            EvalRelation.is_active.is_(True),
            EvalRelation.role_code == RoleCode.EDITOR_LEAD,
            EvalRelation.rater_user_id != rater_user_id,
            EvalRelation.employee_id.in_(target_ids),
        )
    ).all()
    return [
        {
            "employeeId": employee_id,
            "name": name,
            "empNo": emp_no,
            "currentLeadUserId": lead_id,
            "currentLeadName": lead_name,
        }
        for employee_id, name, emp_no, lead_id, lead_name in rows
    ]


def save_targets(
    db: Session,
    actor: CurrentUser,
    rater_user_id: int,
    role_code: str | None,
    target_ids: list[int],
    coverage_mode: str,
) -> dict:
    if coverage_mode not in (CoverageMode.ALL, CoverageMode.EXPLICIT):
        raise BizError("覆盖方式只能是 ALL 或 EXPLICIT")
    user, resolved_role = _resolve_role(db, rater_user_id, role_code)
    profile = _ensure_profile(db, user.id, resolved_role)
    employees = {item["id"]: item for item in _employee_rows(db)}
    before_ids = list(
        db.scalars(
            select(EvalRelation.employee_id).where(
                EvalRelation.rater_user_id == user.id,
                EvalRelation.role_code == resolved_role,
                EvalRelation.is_active.is_(True),
            )
        )
    )

    if coverage_mode == CoverageMode.ALL:
        previous_mode = profile.coverage_mode
        profile.coverage_mode = CoverageMode.ALL
        rows = db.scalars(
            select(EvalRelation).where(
                EvalRelation.rater_user_id == user.id,
                EvalRelation.role_code == resolved_role,
                EvalRelation.is_active.is_(True),
            )
        ).all()
        for row in rows:
            row.is_active = False
            row.effective_to = date.today()
        write_audit(
            db,
            actor,
            "RATER_PROFILE_UPDATE",
            "rater_profile",
            profile.id,
            f"{user.display_name} 的 {ROLE_LABELS.get(resolved_role, resolved_role)} 覆盖方式改为全体在职",
            {"coverageMode": previous_mode, "targetIds": before_ids},
            {"coverageMode": CoverageMode.ALL, "targetIds": []},
        )
        db.commit()
        cleared_names = [employees[i]["name"] for i in before_ids if i in employees]
        return {
            "coverageMode": CoverageMode.ALL,
            "addedNames": [],
            "removedNames": cleared_names,
            "addedCount": 0,
            "removedCount": len(cleared_names),
            "totalCount": len(employees),
        }

    unknown = [i for i in target_ids if i not in employees]
    if unknown:
        raise BizError(
            "勾选名单里有已离职或不存在的员工，请刷新页面后重新勾选",
            ErrorCode.VALIDATION,
            ShowType.ERROR,
            {"invalidIds": unknown},
        )

    if resolved_role == RoleCode.EDITOR_LEAD:
        conflicts = _lead_conflicts(db, user.id, target_ids)
        if conflicts:
            names = "、".join(f"{c['name']}（现属 {c['currentLeadName']}）" for c in conflicts)
            raise BizError(
                f"一个编辑只能归属一位主管，以下员工已有主管：{names}",
                ErrorCode.DUPLICATE_LEAD,
                ShowType.ERROR,
                {"conflicts": conflicts, "conflictNames": [c["name"] for c in conflicts]},
            )

    previous_mode = profile.coverage_mode
    profile.coverage_mode = CoverageMode.EXPLICIT
    target_set = set(target_ids)
    before_set = {i for i in before_ids if i in employees}
    removed = sorted(before_set - target_set)
    added = sorted(target_set - before_set)

    if removed:
        rows = db.scalars(
            select(EvalRelation).where(
                EvalRelation.rater_user_id == user.id,
                EvalRelation.role_code == resolved_role,
                EvalRelation.is_active.is_(True),
                EvalRelation.employee_id.in_(removed),
            )
        ).all()
        for row in rows:
            row.is_active = False
            row.effective_to = date.today()
        db.flush()

    reusable: dict[int, EvalRelation] = {}
    if added:
        reusable = {
            row.employee_id: row
            for row in db.scalars(
                select(EvalRelation)
                .where(
                    EvalRelation.rater_user_id == user.id,
                    EvalRelation.role_code == resolved_role,
                    EvalRelation.employee_id.in_(added),
                    EvalRelation.is_active.is_(False),
                )
                .order_by(EvalRelation.id)
            )
        }
    for employee_id in added:
        existing = reusable.get(employee_id)
        if existing is not None:
            existing.is_active = True
            existing.source = "manual"
            existing.effective_from = date.today()
            existing.effective_to = None
        else:
            db.add(
                EvalRelation(
                    employee_id=employee_id,
                    rater_user_id=user.id,
                    role_code=resolved_role,
                    source="manual",
                    is_active=True,
                    effective_from=date.today(),
                )
            )
    db.flush()

    added_names = [employees[i]["name"] for i in added if i in employees]
    removed_names = [employees[i]["name"] for i in removed if i in employees]
    write_audit(
        db,
        actor,
        "RELATION_SAVE",
        "eval_relation",
        user.id,
        f"{user.display_name} 的 {ROLE_LABELS.get(resolved_role, resolved_role)} 名单新增 {len(added)} 人，移除 {len(removed)} 人",
        {"coverageMode": previous_mode, "targetIds": before_ids},
        {"coverageMode": CoverageMode.EXPLICIT, "targetIds": sorted(target_set)},
    )
    db.commit()
    return {
        "coverageMode": CoverageMode.EXPLICIT,
        "addedNames": added_names,
        "removedNames": removed_names,
        "addedCount": len(added),
        "removedCount": len(removed),
        "totalCount": len(target_set),
    }


def _coverage_index(db: Session, employees: list[dict], raters: list[dict]) -> dict[int, dict[str, set[int]]]:
    index: dict[int, dict[str, set[int]]] = {item["id"]: {} for item in employees}
    employee_ids = set(index.keys())
    rows = db.execute(
        select(EvalRelation.employee_id, EvalRelation.rater_user_id, EvalRelation.role_code).where(
            EvalRelation.is_active.is_(True)
        )
    ).all()
    for employee_id, rater_user_id, role_code in rows:
        if employee_id in employee_ids:
            index[employee_id].setdefault(role_code, set()).add(rater_user_id)
    for rater in raters:
        if rater["coverageMode"] != CoverageMode.ALL or not rater["isActive"]:
            continue
        for employee_id in employee_ids:
            index[employee_id].setdefault(rater["roleCode"], set()).add(rater["userId"])
    return index


def build_matrix(db: Session) -> dict:
    employees = _employee_rows(db)
    raters = list_raters(db, len(employees))
    weights = _role_weights(db)
    weight_map = {item["roleCode"]: item["weight"] for item in weights}
    index = _coverage_index(db, employees, raters)

    cells = []
    for employee in employees:
        by_role = index.get(employee["id"], {})
        covered_roles = sorted(by_role.keys())
        rater_ids: set[int] = set()
        for role_code, ids in by_role.items():
            rater_ids.update(ids)
            for rater_user_id in ids:
                cells.append(
                    {
                        "employeeId": employee["id"],
                        "raterUserId": rater_user_id,
                        "roleCode": role_code,
                        "expanded": any(
                            r["userId"] == rater_user_id
                            and r["roleCode"] == role_code
                            and r["coverageMode"] == CoverageMode.ALL
                            for r in raters
                        ),
                    }
                )
        employee["raterCount"] = len(rater_ids)
        employee["coveredRoles"] = covered_roles
        employee["missingRoles"] = [w["roleCode"] for w in weights if w["roleCode"] not in by_role]
        employee["nominalCoverage"] = round(sum(weight_map.get(r, 0.0) for r in covered_roles), 4)

    insufficient = [e for e in employees if e["raterCount"] < 2]
    missing_lead = [e for e in employees if RoleCode.EDITOR_LEAD in e["missingRoles"]]
    missing_delivery = [e for e in employees if RoleCode.DELIVERY in e["missingRoles"]]
    return {
        "raters": raters,
        "employees": employees,
        "cells": cells,
        "roleWeights": weights,
        "summary": {
            "employeeCount": len(employees),
            "raterCount": len(raters),
            "cellCount": len(cells),
            "insufficientCount": len(insufficient),
            "insufficientNames": [e["name"] for e in insufficient],
            "missingLeadCount": len(missing_lead),
            "missingLeadNames": [e["name"] for e in missing_lead],
            "missingDeliveryCount": len(missing_delivery),
            "missingDeliveryNames": [e["name"] for e in missing_delivery],
            "avgRaterCount": round(sum(e["raterCount"] for e in employees) / len(employees), 2) if employees else 0,
        },
    }


def coverage_check(db: Session) -> dict:
    employees = _employee_rows(db)
    raters = list_raters(db, len(employees))
    weights = _role_weights(db)
    weight_map = {item["roleCode"]: item["weight"] for item in weights}
    index = _coverage_index(db, employees, raters)
    rater_names = {(item["userId"], item["roleCode"]): item["displayName"] for item in raters}

    items = []
    for employee in employees:
        by_role = index.get(employee["id"], {})
        covered_roles = [w["roleCode"] for w in weights if w["roleCode"] in by_role]
        extra_roles = [r for r in by_role if r not in weight_map]
        covered_roles.extend(sorted(extra_roles))
        missing_roles = [w["roleCode"] for w in weights if w["roleCode"] not in by_role]
        rater_ids: set[int] = set()
        for role_code, ids in by_role.items():
            rater_ids.update(ids)
        nominal = round(sum(weight_map.get(role_code, 0.0) for role_code in covered_roles), 4)
        items.append(
            {
                "employeeId": employee["id"],
                "name": employee["name"],
                "empNo": employee["empNo"],
                "tags": employee["tags"],
                "leadName": employee["leadName"],
                "coveredRoles": covered_roles,
                "coveredRoleLabels": [ROLE_LABELS.get(code, code) for code in covered_roles],
                "missingRoles": missing_roles,
                "missingRoleLabels": [ROLE_LABELS.get(code, code) for code in missing_roles],
                "raterCount": len(rater_ids),
                "raterNames": sorted(
                    {
                        rater_names.get((rater_user_id, role_code), "")
                        for role_code, ids in by_role.items()
                        for rater_user_id in ids
                    }
                    - {""}
                ),
                "nominalCoverage": nominal,
                "hasLead": RoleCode.EDITOR_LEAD in by_role,
                "hasDelivery": RoleCode.DELIVERY in by_role,
                "passed": RoleCode.EDITOR_LEAD in by_role and len(rater_ids) >= 2,
            }
        )

    blocked = [item for item in items if not item["passed"]]
    return {
        "items": items,
        "roleWeights": weights,
        "summary": {
            "employeeCount": len(items),
            "passedCount": len(items) - len(blocked),
            "blockedCount": len(blocked),
            "noLeadNames": [item["name"] for item in items if not item["hasLead"]],
            "noDeliveryNames": [item["name"] for item in items if not item["hasDelivery"]],
            "thinNames": [item["name"] for item in items if item["raterCount"] < 2],
            "avgNominalCoverage": round(sum(item["nominalCoverage"] for item in items) / len(items), 4)
            if items
            else 0,
        },
    }


def copy_from_last(db: Session, actor: CurrentUser) -> dict:
    period = db.scalar(select(EvalPeriod).order_by(EvalPeriod.year.desc(), EvalPeriod.month.desc()))
    if period is None:
        return {
            "applied": False,
            "createdCount": 0,
            "periodCode": None,
            "message": "系统中还没有任何评价周期，无法复制历史关系，请先在本页手工配置名单",
        }

    employees = {item["id"]: item for item in _employee_rows(db)}
    rows = db.execute(
        select(EvalSubmission.employee_id, EvalSubmission.rater_user_id, EvalSubmission.role_code)
        .where(EvalSubmission.period_id == period.id)
        .distinct()
    ).all()
    if not rows:
        return {
            "applied": False,
            "createdCount": 0,
            "periodCode": period.code,
            "message": f"{period.code} 周期没有留下任何评价记录，无可复制的关系",
        }

    active_rows = db.execute(
        select(EvalRelation.employee_id, EvalRelation.rater_user_id, EvalRelation.role_code).where(
            EvalRelation.is_active.is_(True)
        )
    ).all()
    existing = {(employee_id, rater_user_id, role_code) for employee_id, rater_user_id, role_code in active_rows}
    lead_owner = {
        employee_id: rater_user_id
        for employee_id, rater_user_id, role_code in active_rows
        if role_code == RoleCode.EDITOR_LEAD
    }
    all_modes = {
        (item["userId"], item["roleCode"])
        for item in list_raters(db, len(employees))
        if item["coverageMode"] == CoverageMode.ALL
    }

    candidates = []
    for employee_id, rater_user_id, role_code in rows:
        if employee_id not in employees:
            continue
        if (rater_user_id, role_code) in all_modes:
            continue
        key = (employee_id, rater_user_id, role_code)
        if key in existing:
            continue
        if role_code == RoleCode.EDITOR_LEAD:
            owner = lead_owner.get(employee_id)
            if owner is not None and owner != rater_user_id:
                continue
            lead_owner[employee_id] = rater_user_id
        existing.add(key)
        candidates.append(key)

    reusable: dict[tuple[int, int, str], EvalRelation] = {}
    if candidates:
        reusable = {
            (row.employee_id, row.rater_user_id, row.role_code): row
            for row in db.scalars(
                select(EvalRelation)
                .where(
                    EvalRelation.is_active.is_(False),
                    EvalRelation.employee_id.in_({key[0] for key in candidates}),
                )
                .order_by(EvalRelation.id)
            )
        }

    created_pairs = []
    for key in candidates:
        employee_id, rater_user_id, role_code = key
        record = reusable.get(key)
        if record is not None:
            record.is_active = True
            record.source = "copy"
            record.effective_from = date.today()
            record.effective_to = None
        else:
            db.add(
                EvalRelation(
                    employee_id=employee_id,
                    rater_user_id=rater_user_id,
                    role_code=role_code,
                    source="copy",
                    is_active=True,
                    effective_from=date.today(),
                )
            )
        created_pairs.append({"employeeId": employee_id, "raterUserId": rater_user_id, "roleCode": role_code})
    created = len(created_pairs)
    db.flush()

    write_audit(
        db,
        actor,
        "RELATION_SAVE",
        "eval_relation",
        None,
        f"从 {period.code} 周期复制评价关系，新增 {created} 条",
        None,
        {"periodCode": period.code, "created": created_pairs},
        period_id=period.id,
    )
    db.commit()
    return {
        "applied": created > 0,
        "createdCount": created,
        "periodCode": period.code,
        "message": f"已从 {period.code} 周期复制 {created} 条评价关系" if created else f"{period.code} 周期的关系与当前一致，无需复制",
    }
