from enum import StrEnum


class RoleCode(StrEnum):
    ADMIN = "admin"
    EDITOR_LEAD = "editor_lead"
    DELIVERY = "delivery"
    CS = "cs"
    HR = "hr"
    EMPLOYEE = "employee"


RATER_ROLES = (RoleCode.EDITOR_LEAD, RoleCode.DELIVERY, RoleCode.CS, RoleCode.HR)

ROLE_LABELS = {
    RoleCode.ADMIN: "系统管理员",
    RoleCode.EDITOR_LEAD: "直属编辑主管",
    RoleCode.DELIVERY: "交付对接老师",
    RoleCode.CS: "客服主管",
    RoleCode.HR: "人事主管",
    RoleCode.EMPLOYEE: "编辑",
}


class CoverageMode(StrEnum):
    ALL = "ALL"
    EXPLICIT = "EXPLICIT"


class EmploymentStatus(StrEnum):
    PROBATION = "probation"
    REGULAR = "regular"
    LEAVING = "leaving"
    LEFT = "left"
    SUSPENDED = "suspended"


ACTIVE_EMPLOYMENT = (
    EmploymentStatus.PROBATION,
    EmploymentStatus.REGULAR,
    EmploymentStatus.LEAVING,
)


class PeriodStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    COMPUTED = "computed"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class SubmissionStatus(StrEnum):
    PENDING = "PENDING"
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNKNOWN = "UNKNOWN"
    EXPIRED = "EXPIRED"


class AdjustType(StrEnum):
    FREEZE = "FREEZE"
    OVERRIDE = "OVERRIDE"
    MULTIPLIER = "MULTIPLIER"
    DELTA = "DELTA"


class AdjustStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class CoverageLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    THIN = "THIN"
    NONE = "NONE"


class RunStatus(StrEnum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class AlertCode(StrEnum):
    MISSING_LEAD = "MISSING_LEAD"
    LOW_COVERAGE = "LOW_COVERAGE"
    RATER_LOW_VARIANCE = "RATER_LOW_VARIANCE"
    BLOCK_NO_DISCRIMINATION = "BLOCK_NO_DISCRIMINATION"
    SCORE_JUMP = "SCORE_JUMP"
    CARRY_FORWARD = "CARRY_FORWARD"


class ErrorCode:
    UNAUTHORIZED = 40100
    FORBIDDEN = 40300
    NOT_FOUND = 40400
    VALIDATION = 42200
    COMMENT_REQUIRED = 42201
    DUPLICATE_LEAD = 40901
    DUPLICATE_PERIOD = 40902
    STATE_CONFLICT = 40903
    INTERNAL = 50000


class ShowType:
    SILENT = 0
    WARN = 1
    ERROR = 2
    NOTIFICATION = 3
    REDIRECT = 9
