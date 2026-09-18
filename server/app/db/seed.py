from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import ROLE_LABELS, CoverageMode, RoleCode
from app.core.security import hash_password
from app.models import (
    AlgoConfig,
    Employee,
    EmployeeTag,
    EvalRelation,
    Tag,
    ConfigFamiliarity,
    ConfigGradeBand,
    ConfigItem,
    ConfigRoleWeight,
    RaterProfile,
    SysRole,
    SysUser,
    SysUserRole,
)

ROLE_SEED = [
    (RoleCode.ADMIN, False, 1),
    (RoleCode.EDITOR_LEAD, True, 2),
    (RoleCode.DELIVERY, True, 3),
    (RoleCode.CS, True, 4),
    (RoleCode.HR, True, 5),
    (RoleCode.EMPLOYEE, False, 6),
]

RATER_SEED = [
    ("xiaoxin", "小欣", [RoleCode.ADMIN, RoleCode.EDITOR_LEAD], CoverageMode.EXPLICIT),
    ("arui", "阿瑞", [RoleCode.EDITOR_LEAD], CoverageMode.EXPLICIT),
    ("miaomiao", "苗苗", [RoleCode.HR], CoverageMode.ALL),
    ("wuwen", "无问", [RoleCode.CS], CoverageMode.ALL),
    ("paofu", "泡芙", [RoleCode.DELIVERY], CoverageMode.ALL),
    ("qitian", "七天", [RoleCode.DELIVERY], CoverageMode.ALL),
    ("yiyi", "伊一", [RoleCode.DELIVERY], CoverageMode.ALL),
]

TEST_ACCOUNT = ("test", "测试账号", [RoleCode.ADMIN, RoleCode.DELIVERY, RoleCode.CS, RoleCode.HR], CoverageMode.EXPLICIT)

TAG_SEED = [
    ("本科", "blue", 1, True),
    ("硕士", "purple", 2, True),
]

EMPLOYEE_SEED = [
    ("E001", "不吃肉", "buchirou", "xiaoxin", ["本科"]),
    ("E002", "刘哈哈", "liuhaha", "xiaoxin", ["本科"]),
    ("E003", "苏苏", "susu", "xiaoxin", ["本科"]),
    ("E004", "十一", "shiyi", "xiaoxin", ["本科"]),
    ("E005", "月亮", "yueliang", "xiaoxin", ["本科"]),
    ("E006", "榛子", "zhenzi", "xiaoxin", ["本科"]),
    ("E007", "烟雾镜", "yanwujing", "xiaoxin", ["硕士"]),
    ("E008", "露露", "lulu", "xiaoxin", ["硕士"]),
    ("E009", "小鱼", "xiaoyu", "xiaoxin", ["硕士"]),
    ("E010", "灵犀", "lingxi", "arui", ["硕士"]),
    ("E011", "确确", "queque", "arui", ["硕士"]),
    ("E012", "扫地僧", "saodiseng", "arui", ["硕士"]),
]

ROLE_WEIGHT_SEED = [
    (RoleCode.EDITOR_LEAD, "直属编辑主管", 0.45, 1.0, True, 1),
    (RoleCode.DELIVERY, "交付对接", 0.25, 1.2, False, 2),
    (RoleCode.CS, "客服主管", 0.18, 1.0, False, 3),
    (RoleCode.HR, "人事主管", 0.12, 1.0, False, 4),
]

ITEM_SEED = [
    (RoleCode.EDITOR_LEAD, "quality", "交稿质量", 0.35, "5分为几乎无需返修，3分为常规修改即可通过，1分为频繁整体重写"),
    (RoleCode.EDITOR_LEAD, "expertise", "专业能力", 0.25, "涵盖学科匹配度、文献处理与方法规范程度"),
    (RoleCode.EDITOR_LEAD, "revision", "修改配合度", 0.20, "对修改意见的响应速度与落实程度"),
    (RoleCode.EDITOR_LEAD, "punctuality", "交付及时性", 0.20, "是否按约定节点交稿，有无无故拖延"),
    (RoleCode.DELIVERY, "satisfaction", "客户满意反馈", 0.40, "来自客户端的主观评价汇总印象"),
    (RoleCode.DELIVERY, "response", "沟通响应速度", 0.30, "对接消息的回复时效与主动程度"),
    (RoleCode.DELIVERY, "rework", "返稿处理表现", 0.30, "返稿后的态度、完成速度与完成质量"),
    (RoleCode.CS, "attitude", "服务态度", 0.40, "与客户沟通中的礼貌程度与耐心程度"),
    (RoleCode.CS, "compliance", "沟通规范", 0.30, "是否遵守话术规范与信息安全红线"),
    (RoleCode.CS, "complaint", "投诉情况", 0.30, "本期有效投诉的数量与严重程度"),
    (RoleCode.HR, "morale", "工作状态", 0.35, "精神面貌与任务承接意愿"),
    (RoleCode.HR, "attendance", "出勤与在线稳定", 0.30, "请假频次、失联情况与响应时段稳定性"),
    (RoleCode.HR, "teamwork", "团队配合", 0.20, "协作意愿与互助表现"),
    (RoleCode.HR, "discipline", "纪律遵守", 0.15, "制度执行情况与私单风险"),
]

FAMILIARITY_SEED = [
    ("VERY", "很熟悉", 1.0, False, 1),
    ("NORMAL", "一般", 0.6, False, 2),
    ("LOW", "不太熟", 0.3, False, 3),
    ("UNKNOWN", "不了解", 0.0, True, 4),
]

GRADE_SEED = [
    ("S", "S档", 90.0, 100.0, "green", "优先分配，可承接高价与高难度稿件", 1),
    ("A", "A档", 80.0, 89.999, "cyan", "优先分配常规稿件", 2),
    ("B", "B档", 70.0, 79.999, "blue", "正常分配", 3),
    ("C", "C档", 60.0, 69.999, "orange", "限量分配，进入观察名单", 4),
    ("D", "D档", 0.0, 59.999, "red", "暂停分配，进入淘汰或转岗流程", 5),
]


def seed_all(db: Session) -> dict:
    created = {"roles": 0, "raters": 0, "employees": 0, "tags": 0, "relations": 0, "config": 0}

    for code, is_rater, order in ROLE_SEED:
        if not db.scalar(select(SysRole).where(SysRole.code == code)):
            db.add(SysRole(code=code, name=ROLE_LABELS[code], is_rater=is_rater, sort_order=order))
            created["roles"] += 1
    db.flush()

    def ensure_user(username: str, display_name: str, must_change: bool = True) -> SysUser:
        user = db.scalar(select(SysUser).where(SysUser.username == username))
        if user:
            return user
        user = SysUser(
            username=username,
            password_hash=hash_password(username),
            display_name=display_name,
            status="active",
            must_change_pwd=must_change,
        )
        db.add(user)
        db.flush()
        return user

    rater_ids: dict[str, int] = {}
    for username, display_name, roles, coverage in [*RATER_SEED, TEST_ACCOUNT]:
        user = ensure_user(username, display_name)
        if user.display_name != display_name:
            user.display_name = display_name
        rater_ids[username] = user.id
        created["raters"] += 1
        for role_code in roles:
            if not db.scalar(
                select(SysUserRole).where(SysUserRole.user_id == user.id, SysUserRole.role_code == role_code)
            ):
                db.add(SysUserRole(user_id=user.id, role_code=role_code))
            if role_code == RoleCode.ADMIN:
                continue
            if not db.scalar(
                select(RaterProfile).where(RaterProfile.user_id == user.id, RaterProfile.role_code == role_code)
            ):
                db.add(RaterProfile(user_id=user.id, role_code=role_code, coverage_mode=coverage))
    db.flush()

    tag_ids: dict[str, int] = {}
    for name, color, order, is_group in TAG_SEED:
        tag = db.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            tag = Tag(name=name, color=color, sort_order=order, is_group=is_group)
            db.add(tag)
            db.flush()
            created["tags"] += 1
        tag_ids[name] = tag.id

    for emp_no, name, username, lead_username, tag_names in EMPLOYEE_SEED:
        employee = db.scalar(select(Employee).where(Employee.emp_no == emp_no))
        if not employee:
            account = ensure_user(username, name)
            if not db.scalar(
                select(SysUserRole).where(
                    SysUserRole.user_id == account.id, SysUserRole.role_code == RoleCode.EMPLOYEE
                )
            ):
                db.add(SysUserRole(user_id=account.id, role_code=RoleCode.EMPLOYEE))
            employee = Employee(emp_no=emp_no, name=name, user_id=account.id, employment_status="regular")
            db.add(employee)
            db.flush()
            created["employees"] += 1
        for tag_name in tag_names:
            tag_id = tag_ids.get(tag_name)
            if tag_id and not db.scalar(
                select(EmployeeTag).where(EmployeeTag.employee_id == employee.id, EmployeeTag.tag_id == tag_id)
            ):
                db.add(EmployeeTag(employee_id=employee.id, tag_id=tag_id))
        lead_id = rater_ids.get(lead_username)
        if lead_id and not db.scalar(
            select(EvalRelation).where(
                EvalRelation.employee_id == employee.id,
                EvalRelation.role_code == RoleCode.EDITOR_LEAD,
                EvalRelation.is_active,
            )
        ):
            db.add(
                EvalRelation(
                    employee_id=employee.id,
                    rater_user_id=lead_id,
                    role_code=RoleCode.EDITOR_LEAD,
                    source="seed",
                )
            )
            created["relations"] += 1
    db.flush()

    config = db.scalar(select(AlgoConfig).where(AlgoConfig.status == "active"))
    if not config:
        config = AlgoConfig(version_no=1, status="active", note="初始配置")
        db.add(config)
        db.flush()
        created["config"] = 1
        for role_code, label, weight, tau, mandatory, order in ROLE_WEIGHT_SEED:
            db.add(
                ConfigRoleWeight(
                    config_id=config.id,
                    role_code=role_code,
                    label=label,
                    weight=weight,
                    familiarity_full_sum=tau,
                    is_mandatory=mandatory,
                    sort_order=order,
                )
            )
        for order, (role_code, code, label, weight, anchor) in enumerate(ITEM_SEED, start=1):
            db.add(
                ConfigItem(
                    config_id=config.id,
                    role_code=role_code,
                    code=code,
                    label=label,
                    weight=weight,
                    anchor_text=anchor,
                    sort_order=order,
                )
            )
        for code, label, weight, is_unknown, order in FAMILIARITY_SEED:
            db.add(
                ConfigFamiliarity(
                    config_id=config.id,
                    code=code,
                    label=label,
                    weight=weight,
                    is_unknown=is_unknown,
                    sort_order=order,
                )
            )
        for code, label, lower, upper, color, policy, order in GRADE_SEED:
            db.add(
                ConfigGradeBand(
                    config_id=config.id,
                    code=code,
                    label=label,
                    lower=lower,
                    upper=upper,
                    color=color,
                    policy_text=policy,
                    sort_order=order,
                )
            )

    db.commit()
    return created
