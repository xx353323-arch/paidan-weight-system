from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.constants import (
    ROLE_LABELS,
    ErrorCode,
    PeriodStatus,
    RoleCode,
    ShowType,
    SubmissionStatus,
)
from app.core.deps import CurrentUser
from app.core.errors import BizError, NotFoundError, PermissionError_, StateConflictError
from app.db.base import now
from app.models import (
    AlgoConfig,
    ConfigFamiliarity,
    ConfigItem,
    Employee,
    EmployeeTag,
    EvalItemScore,
    EvalPeriod,
    EvalRelation,
    EvalSubmission,
    SysUser,
    Tag,
)
from app.schemas.evaluation import EvalRecordInput
from app.utils.pagination import PageParams

PERIOD_STATUS_LABELS = {
    PeriodStatus.DRAFT: "草稿",
    PeriodStatus.OPEN: "进行中",
    PeriodStatus.CLOSED: "已截止",
    PeriodStatus.COMPUTED: "已跑批",
    PeriodStatus.PUBLISHED: "已发布",
    PeriodStatus.ARCHIVED: "已归档",
}

FAMILIARITY_FIELD = "familiarity"
FAMILIARITY_INPUT_FIELD = "familiarityCode"
COMMENT_MIN_LENGTH = 10
DONE_STATUS = (SubmissionStatus.SUBMITTED, SubmissionStatus.UNKNOWN)


def _rater_role(user: CurrentUser) -> str:
    return user.rater_roles[0] if user.rater_roles else ""


def _require_role(user: CurrentUser) -> str:
    role_code = _rater_role(user)
    if not role_code:
        raise PermissionError_("当前账号没有评价角色，无法进行打分操作")
    return role_code


def _resolve_period(db: Session, period_id: int | None) -> EvalPeriod | None:
    if period_id:
        period = db.get(EvalPeriod, period_id)
        if period is None:
            raise NotFoundError("评价周期不存在")
        return period
    period = db.scalar(select(EvalPeriod).where(EvalPeriod.status == PeriodStatus.OPEN))
    if period is None:
        period = db.scalar(select(EvalPeriod).order_by(EvalPeriod.code.desc()))
    return period


def _writable_period(db: Session, period_id: int | None) -> EvalPeriod:
    period = _resolve_period(db, period_id)
    if period is None:
        raise NotFoundError("当前没有进行中的评价周期")
    if period.status != PeriodStatus.OPEN:
        label = PERIOD_STATUS_LABELS.get(period.status, period.status)
        raise StateConflictError(f"周期 {period.code} 当前为{label}状态，不能再修改评分")
    return period


def _config_id(db: Session, period: EvalPeriod) -> int | None:
    if period.config_id:
        return period.config_id
    config = db.scalar(
        select(AlgoConfig).where(AlgoConfig.status == "active").order_by(AlgoConfig.version_no.desc())
    )
    return config.id if config else None


def _config_items(db: Session, config_id: int | None, role_code: str) -> list[ConfigItem]:
    if not config_id or not role_code:
        return []
    return list(
        db.scalars(
            select(ConfigItem)
            .where(
                ConfigItem.config_id == config_id,
                ConfigItem.role_code == role_code,
                ConfigItem.is_active.is_(True),
            )
            .order_by(ConfigItem.sort_order, ConfigItem.id)
        )
    )


def _familiarity_options(db: Session, config_id: int | None) -> list[ConfigFamiliarity]:
    if not config_id:
        return []
    return list(
        db.scalars(
            select(ConfigFamiliarity)
            .where(ConfigFamiliarity.config_id == config_id)
            .order_by(ConfigFamiliarity.sort_order, ConfigFamiliarity.id)
        )
    )


def _coerce_score(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != int(number):
        return None
    number = int(number)
    if number < 1 or number > 5:
        return None
    return number


def _clean_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _dedupe_records(records: list[EvalRecordInput]) -> list[EvalRecordInput]:
    merged: dict[int, EvalRecordInput] = {}
    for record in records:
        merged[record.employeeId] = record
    return list(merged.values())


def _dedupe_ids(employee_ids: list[int]) -> list[int]:
    return list(dict.fromkeys(employee_ids))


def _employee_map(db: Session, employee_ids: list[int]) -> dict[int, Employee]:
    if not employee_ids:
        return {}
    rows = db.scalars(select(Employee).where(Employee.id.in_(employee_ids))).all()
    return {row.id: row for row in rows}


def _tag_map(db: Session, employee_ids: list[int]) -> dict[int, list[dict]]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EmployeeTag.employee_id, Tag.id, Tag.name, Tag.color)
        .join(Tag, Tag.id == EmployeeTag.tag_id)
        .where(EmployeeTag.employee_id.in_(employee_ids))
        .order_by(Tag.sort_order, Tag.id)
    ).all()
    result: dict[int, list[dict]] = {}
    for employee_id, tag_id, name, color in rows:
        result.setdefault(employee_id, []).append({"id": tag_id, "name": name, "color": color})
    return result


def _lead_map(db: Session, employee_ids: list[int]) -> dict[int, dict]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(EvalRelation.employee_id, SysUser.id, SysUser.display_name)
        .join(SysUser, SysUser.id == EvalRelation.rater_user_id)
        .where(
            EvalRelation.is_active.is_(True),
            EvalRelation.role_code == RoleCode.EDITOR_LEAD,
            EvalRelation.employee_id.in_(employee_ids),
        )
    ).all()
    return {employee_id: {"userId": user_id, "name": name} for employee_id, user_id, name in rows}


def _score_map(db: Session, submission_ids: list[int]) -> dict[int, list[EvalItemScore]]:
    if not submission_ids:
        return {}
    rows = db.scalars(
        select(EvalItemScore).where(EvalItemScore.submission_id.in_(submission_ids)).order_by(EvalItemScore.id)
    ).all()
    result: dict[int, list[EvalItemScore]] = {}
    for row in rows:
        result.setdefault(row.submission_id, []).append(row)
    return result


def _my_submissions(db: Session, user: CurrentUser, period: EvalPeriod, role_code: str) -> list[EvalSubmission]:
    return list(
        db.scalars(
            select(EvalSubmission).where(
                EvalSubmission.period_id == period.id,
                EvalSubmission.rater_user_id == user.id,
                EvalSubmission.role_code == role_code,
            )
        )
    )


def _owned_submissions(
    db: Session, user: CurrentUser, period: EvalPeriod, role_code: str, employee_ids: list[int]
) -> dict[int, EvalSubmission]:
    if not employee_ids:
        return {}
    rows = db.scalars(
        select(EvalSubmission).where(
            EvalSubmission.period_id == period.id,
            EvalSubmission.rater_user_id == user.id,
            EvalSubmission.role_code == role_code,
            EvalSubmission.employee_id.in_(employee_ids),
        )
    ).all()
    mapping = {row.employee_id: row for row in rows}
    missing = [employee_id for employee_id in employee_ids if employee_id not in mapping]
    if missing:
        names = _employee_map(db, missing)
        detail = "、".join(names[i].name if i in names else str(i) for i in missing)
        raise PermissionError_(f"以下人员不在你本周期的评价名单内：{detail}")
    return mapping


def _period_payload(period: EvalPeriod | None) -> dict | None:
    if period is None:
        return None
    return {
        "id": period.id,
        "code": period.code,
        "status": period.status,
        "statusLabel": PERIOD_STATUS_LABELS.get(period.status, period.status),
        "closeAt": period.close_at,
        "openAt": period.open_at,
    }


def build_tasks(db: Session, user: CurrentUser, period_id: int | None) -> dict:
    role_code = _rater_role(user)
    period = _resolve_period(db, period_id)
    empty = {
        "period": _period_payload(period),
        "roleCode": role_code,
        "roleLabel": ROLE_LABELS.get(role_code, role_code),
        "items": [],
        "familiarityOptions": [],
        "targets": [],
        "summary": {"total": 0, "submitted": 0, "unknown": 0, "draft": 0, "pending": 0},
        "editable": False,
    }
    if period is None or not role_code:
        return empty

    config_id = _config_id(db, period)
    items = _config_items(db, config_id, role_code)
    familiarity = _familiarity_options(db, config_id)
    submissions = _my_submissions(db, user, period, role_code)
    employee_ids = [row.employee_id for row in submissions]
    employees = _employee_map(db, employee_ids)
    tags = _tag_map(db, employee_ids)
    leads = _lead_map(db, employee_ids)
    scores = _score_map(db, [row.id for row in submissions])

    targets = []
    counter = {"submitted": 0, "unknown": 0, "draft": 0, "pending": 0}
    for submission in submissions:
        employee = employees.get(submission.employee_id)
        lead = leads.get(submission.employee_id)
        item_rows = scores.get(submission.id, [])
        if submission.status == SubmissionStatus.SUBMITTED:
            counter["submitted"] += 1
        elif submission.status == SubmissionStatus.UNKNOWN:
            counter["unknown"] += 1
        elif submission.status == SubmissionStatus.DRAFT:
            counter["draft"] += 1
        else:
            counter["pending"] += 1
        targets.append(
            {
                "employeeId": submission.employee_id,
                "empNo": employee.emp_no if employee else "",
                "name": employee.name if employee else "",
                "leadUserId": lead["userId"] if lead else None,
                "leadName": lead["name"] if lead else None,
                "tags": tags.get(submission.employee_id, []),
                "status": submission.status,
                "familiarityCode": submission.familiarity_code,
                "scores": {row.item_code: row.score for row in item_rows},
                "comments": {row.item_code: row.comment for row in item_rows if row.comment},
                "overallComment": submission.overall_comment,
                "updatedAt": submission.updated_at,
            }
        )

    targets.sort(key=lambda x: (x["empNo"], x["employeeId"]))
    total = len(targets)
    done = counter["submitted"] + counter["unknown"]
    return {
        "period": _period_payload(period),
        "roleCode": role_code,
        "roleLabel": ROLE_LABELS.get(role_code, role_code),
        "items": [
            {
                "code": item.code,
                "label": item.label,
                "weight": item.weight,
                "anchorText": item.anchor_text,
                "commentRequiredBelow": item.comment_required_below,
            }
            for item in items
        ],
        "familiarityOptions": [
            {
                "code": option.code,
                "label": option.label,
                "weight": option.weight,
                "isUnknown": bool(option.is_unknown),
            }
            for option in familiarity
        ],
        "targets": targets,
        "summary": {"total": total, **counter},
        "editable": period.status == PeriodStatus.OPEN and done < total,
    }


def _replace_item_scores(
    db: Session,
    submission: EvalSubmission,
    items: list[ConfigItem],
    record: EvalRecordInput,
    existing: dict[str, EvalItemScore],
) -> float:
    raw = 0.0
    for item in items:
        if item.code not in record.scores:
            row = existing.get(item.code)
            if row is not None:
                raw += row.score * item.weight
            continue
        score = _coerce_score(record.scores.get(item.code))
        row = existing.get(item.code)
        if score is None:
            if row is not None:
                db.delete(row)
                existing.pop(item.code, None)
            continue
        comment = _clean_text(record.comments.get(item.code)) or None
        if row is None:
            row = EvalItemScore(
                submission_id=submission.id,
                item_code=item.code,
                item_label=item.label,
                item_weight=item.weight,
                score=score,
                comment=comment,
            )
            db.add(row)
            existing[item.code] = row
        else:
            row.item_label = item.label
            row.item_weight = item.weight
            row.score = score
            row.comment = comment
        raw += score * item.weight
    return raw


def _clear_item_scores(db: Session, existing: dict[str, EvalItemScore]) -> None:
    for row in list(existing.values()):
        db.delete(row)
    existing.clear()


def save_draft(db: Session, user: CurrentUser, period_id: int | None, records: list[EvalRecordInput]) -> dict:
    role_code = _require_role(user)
    period = _writable_period(db, period_id)
    config_id = _config_id(db, period)
    items = _config_items(db, config_id, role_code)
    familiarity = {option.code: option for option in _familiarity_options(db, config_id)}

    records = _dedupe_records(records)
    employee_ids = [record.employeeId for record in records]
    submissions = _owned_submissions(db, user, period, role_code, employee_ids)
    score_rows = _score_map(db, [submission.id for submission in submissions.values()])
    current_time = now()

    saved = 0
    for record in records:
        submission = submissions[record.employeeId]
        existing = {row.item_code: row for row in score_rows.get(submission.id, [])}
        code = _clean_text(record.familiarityCode)
        if code:
            if code not in familiarity:
                raise BizError("熟悉度选项无效，请刷新页面后重试")
            submission.familiarity_code = code
        elif FAMILIARITY_INPUT_FIELD in record.model_fields_set:
            submission.familiarity_code = None
            submission.familiarity_weight = None
            submission.unknown_reason = None
        option = familiarity.get(submission.familiarity_code or "")
        if option is not None and option.is_unknown:
            _clear_item_scores(db, existing)
        else:
            _replace_item_scores(db, submission, items, record, existing)
            submission.unknown_reason = None
        submission.overall_comment = _clean_text(record.overallComment) or None
        submission.status = SubmissionStatus.DRAFT
        submission.raw_score = None
        submission.submitted_at = None
        submission.updated_at = current_time
        saved += 1

    write_audit(
        db,
        user,
        "EVAL_DRAFT",
        "eval_submission",
        None,
        f"{user.display_name} 保存 {period.code} 周期草稿 {saved} 条",
        after={"employeeIds": employee_ids},
        period_id=period.id,
    )
    return {"savedCount": saved, "savedAt": current_time}


def submit(db: Session, user: CurrentUser, period_id: int | None, records: list[EvalRecordInput]) -> dict:
    role_code = _require_role(user)
    period = _writable_period(db, period_id)
    config_id = _config_id(db, period)
    items = _config_items(db, config_id, role_code)
    familiarity = {option.code: option for option in _familiarity_options(db, config_id)}
    if not items:
        raise StateConflictError("当前角色还没有配置评价题项，请联系管理员")

    records = _dedupe_records(records)
    employee_ids = [record.employeeId for record in records]
    submissions = _owned_submissions(db, user, period, role_code, employee_ids)
    employees = _employee_map(db, employee_ids)
    score_rows = _score_map(db, [submission.id for submission in submissions.values()])

    field_errors = []
    for record in records:
        name = employees[record.employeeId].name if record.employeeId in employees else ""
        code = _clean_text(record.familiarityCode)
        if not code:
            field_errors.append(
                {
                    "employeeId": record.employeeId,
                    "name": name,
                    "itemCode": FAMILIARITY_FIELD,
                    "message": f"{name} 还没有选择熟悉度",
                }
            )
            continue
        option = familiarity.get(code)
        if option is None:
            field_errors.append(
                {
                    "employeeId": record.employeeId,
                    "name": name,
                    "itemCode": FAMILIARITY_FIELD,
                    "message": f"{name} 的熟悉度选项无效，请刷新页面后重试",
                }
            )
            continue
        if option.is_unknown:
            continue
        for item in items:
            score = _coerce_score(record.scores.get(item.code))
            if score is None:
                field_errors.append(
                    {
                        "employeeId": record.employeeId,
                        "name": name,
                        "itemCode": item.code,
                        "message": f"{name} 的「{item.label}」还没有打分",
                    }
                )
                continue
            if score < item.comment_required_below:
                comment = _clean_text(record.comments.get(item.code))
                if len(comment) < COMMENT_MIN_LENGTH:
                    field_errors.append(
                        {
                            "employeeId": record.employeeId,
                            "name": name,
                            "itemCode": item.code,
                            "message": f"{name} 的「{item.label}」评为 {score} 分，请补充不少于 {COMMENT_MIN_LENGTH} 个字的说明",
                        }
                    )

    if field_errors:
        raise BizError(
            field_errors[0]["message"],
            ErrorCode.COMMENT_REQUIRED,
            ShowType.ERROR,
            {"fieldErrors": field_errors},
        )

    current_time = now()
    submitted_count = 0
    unknown_count = 0
    for record in records:
        submission = submissions[record.employeeId]
        existing = {row.item_code: row for row in score_rows.get(submission.id, [])}
        option = familiarity[_clean_text(record.familiarityCode)]
        submission.familiarity_code = option.code
        submission.overall_comment = _clean_text(record.overallComment) or None
        submission.submitted_at = current_time
        submission.updated_at = current_time
        if option.is_unknown:
            _clear_item_scores(db, existing)
            submission.familiarity_weight = 0.0
            submission.raw_score = None
            submission.status = SubmissionStatus.UNKNOWN
            unknown_count += 1
        else:
            raw = _replace_item_scores(db, submission, items, record, existing)
            submission.familiarity_weight = option.weight
            submission.raw_score = round(raw, 4)
            submission.unknown_reason = None
            submission.status = SubmissionStatus.SUBMITTED
            submitted_count += 1

    write_audit(
        db,
        user,
        "EVAL_SUBMIT",
        "eval_submission",
        None,
        f"{user.display_name} 提交 {period.code} 周期评分 {submitted_count} 条，标记不了解 {unknown_count} 条",
        after={"employeeIds": employee_ids},
        period_id=period.id,
    )
    return {"submittedCount": submitted_count, "unknownCount": unknown_count, "submittedAt": current_time}


def mark_unknown(
    db: Session, user: CurrentUser, period_id: int | None, employee_ids: list[int], reason: str | None
) -> dict:
    role_code = _require_role(user)
    period = _writable_period(db, period_id)
    config_id = _config_id(db, period)
    option = next((item for item in _familiarity_options(db, config_id) if item.is_unknown), None)
    if option is None:
        raise StateConflictError("配置里没有不了解选项，请联系管理员")

    employee_ids = _dedupe_ids(employee_ids)
    submissions = _owned_submissions(db, user, period, role_code, employee_ids)
    score_rows = _score_map(db, [submission.id for submission in submissions.values()])
    current_time = now()
    text = _clean_text(reason) or None

    count = 0
    for employee_id in employee_ids:
        submission = submissions[employee_id]
        existing = {row.item_code: row for row in score_rows.get(submission.id, [])}
        _clear_item_scores(db, existing)
        submission.familiarity_code = option.code
        submission.familiarity_weight = 0.0
        submission.unknown_reason = text
        submission.raw_score = None
        submission.status = SubmissionStatus.UNKNOWN
        submission.submitted_at = current_time
        submission.updated_at = current_time
        count += 1

    write_audit(
        db,
        user,
        "EVAL_UNKNOWN",
        "eval_submission",
        None,
        f"{user.display_name} 在 {period.code} 周期把 {count} 人标记为不了解",
        after={"employeeIds": employee_ids, "reason": text},
        period_id=period.id,
    )
    return {"count": count}


def withdraw(db: Session, user: CurrentUser, period_id: int | None, employee_ids: list[int]) -> dict:
    role_code = _require_role(user)
    period = _writable_period(db, period_id)
    employee_ids = _dedupe_ids(employee_ids)
    submissions = _owned_submissions(db, user, period, role_code, employee_ids)
    current_time = now()

    count = 0
    for employee_id in employee_ids:
        submission = submissions[employee_id]
        if submission.status not in DONE_STATUS:
            continue
        submission.status = SubmissionStatus.DRAFT
        submission.raw_score = None
        submission.familiarity_weight = None
        submission.submitted_at = None
        submission.updated_at = current_time
        count += 1

    write_audit(
        db,
        user,
        "EVAL_WITHDRAW",
        "eval_submission",
        None,
        f"{user.display_name} 撤回 {period.code} 周期评分 {count} 条",
        after={"employeeIds": employee_ids},
        period_id=period.id,
    )
    return {"count": count}


def history(db: Session, user: CurrentUser, period_id: int | None, params: PageParams) -> tuple[list[dict], int]:
    role_code = _rater_role(user)
    if not role_code:
        return [], 0
    conditions = [
        EvalSubmission.rater_user_id == user.id,
        EvalSubmission.role_code == role_code,
        EvalSubmission.status.in_(DONE_STATUS),
    ]
    if period_id:
        conditions.append(EvalSubmission.period_id == period_id)

    total = db.scalar(select(func.count()).select_from(EvalSubmission).where(*conditions)) or 0
    rows = list(
        db.scalars(
            select(EvalSubmission)
            .where(*conditions)
            .order_by(EvalSubmission.submitted_at.desc(), EvalSubmission.id.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    )
    if not rows:
        return [], total

    employees = _employee_map(db, [row.employee_id for row in rows])
    scores = _score_map(db, [row.id for row in rows])
    periods = {
        item.id: item
        for item in db.scalars(select(EvalPeriod).where(EvalPeriod.id.in_({row.period_id for row in rows})))
    }
    config_ids = {item.config_id for item in periods.values() if item.config_id}
    familiarity_rows = (
        db.scalars(select(ConfigFamiliarity).where(ConfigFamiliarity.config_id.in_(config_ids))).all()
        if config_ids
        else []
    )
    familiarity = {(item.config_id, item.code): item.label for item in familiarity_rows}

    items = []
    for row in rows:
        period = periods.get(row.period_id)
        employee = employees.get(row.employee_id)
        label = familiarity.get((period.config_id if period else None, row.familiarity_code or ""), "")
        items.append(
            {
                "id": row.id,
                "periodId": row.period_id,
                "periodCode": period.code if period else "",
                "employeeId": row.employee_id,
                "employeeName": employee.name if employee else "",
                "empNo": employee.emp_no if employee else "",
                "roleCode": row.role_code,
                "roleLabel": ROLE_LABELS.get(row.role_code, row.role_code),
                "familiarityLabel": label,
                "rawScore": row.raw_score,
                "status": row.status,
                "submittedAt": row.submitted_at,
                "items": [
                    {"label": score.item_label, "score": score.score, "comment": score.comment}
                    for score in scores.get(row.id, [])
                ],
            }
        )
    return items, total
