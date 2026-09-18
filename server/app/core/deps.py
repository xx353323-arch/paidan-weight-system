from dataclasses import dataclass, field

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import RATER_ROLES, RoleCode
from app.core.errors import AuthError, PermissionError_
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import RaterProfile, SysUser, SysUserRole


@dataclass
class CurrentUser:
    id: int
    username: str
    display_name: str
    roles: list[str] = field(default_factory=list)
    rater_roles: list[str] = field(default_factory=list)
    coverage_modes: dict[str, str] = field(default_factory=dict)
    must_change_pwd: bool = False

    @property
    def is_admin(self) -> bool:
        return RoleCode.ADMIN in self.roles

    @property
    def is_rater(self) -> bool:
        return len(self.rater_roles) > 0

    def has_role(self, *codes: str) -> bool:
        return any(c in self.roles for c in codes)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    header = request.headers.get("Authorization") or ""
    if not header.startswith("Bearer "):
        raise AuthError()
    payload = decode_access_token(header[7:].strip())
    user_id = int(payload.get("sub", 0))
    user = db.get(SysUser, user_id)
    if not user or user.status != "active" or user.deleted_at is not None:
        raise AuthError()

    roles = list(db.scalars(select(SysUserRole.role_code).where(SysUserRole.user_id == user.id)))
    profiles = db.scalars(select(RaterProfile).where(RaterProfile.user_id == user.id, RaterProfile.is_active)).all()
    rater_roles = [p.role_code for p in profiles if p.role_code in RATER_ROLES]
    coverage = {p.role_code: p.coverage_mode for p in profiles}
    return CurrentUser(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        roles=roles,
        rater_roles=rater_roles,
        coverage_modes=coverage,
        must_change_pwd=user.must_change_pwd,
    )


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise PermissionError_()
    return user


def require_rater(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_rater and not user.is_admin:
        raise PermissionError_("当前账号没有评价权限")
    return user


def require_dispatch_view(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not (user.is_admin or user.is_rater):
        raise PermissionError_()
    return user
