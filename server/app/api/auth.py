from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.config import settings
from app.core.constants import ErrorCode, RoleCode
from app.core.deps import CurrentUser, get_current_user, require_admin
from app.core.errors import AuthError, BizError, NotFoundError
from app.core.response import ok
from app.core.security import (
    check_password_strength,
    create_access_token,
    generate_refresh_token,
    hash_password,
    verify_password,
)
from app.db.base import now
from app.db.session import get_db
from app.models import SysRefreshToken, SysUser
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RefreshRequest

router = APIRouter(tags=["认证"])


def _issue(db: Session, user: SysUser) -> dict:
    token, expires_in = create_access_token(user.id, user.username)
    refresh = generate_refresh_token()
    db.add(
        SysRefreshToken(
            token=refresh,
            user_id=user.id,
            expires_at=now() + timedelta(days=settings.refresh_token_days),
        )
    )
    return {
        "token": token,
        "refreshToken": refresh,
        "expiresIn": expires_in,
        "mustChangePassword": user.must_change_pwd,
    }


def _user_payload(user: CurrentUser) -> dict:
    access = RoleCode.ADMIN if user.is_admin else (user.rater_roles[0] if user.rater_roles else "viewer")
    return {
        "userid": str(user.id),
        "name": user.display_name,
        "username": user.username,
        "access": access,
        "roles": user.roles,
        "raterRoles": user.rater_roles,
        "coverageModes": user.coverage_modes,
        "mustChangePassword": user.must_change_pwd,
    }


@router.post("/auth/login", summary="账号密码登录")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    user = db.scalar(select(SysUser).where(SysUser.username == payload.username, SysUser.deleted_at.is_(None)))

    if user and user.locked_until and user.locked_until > now():
        remain = int((user.locked_until - now()).total_seconds() // 60) + 1
        write_audit(db, None, "AUTH_LOGIN_LOCKED", "sys_user", user.id, f"{user.display_name} 在锁定期内尝试登录", ip=client_ip)
        db.commit()
        raise BizError(f"账号已被临时锁定，请 {remain} 分钟后再试", ErrorCode.VALIDATION)

    if not user or not verify_password(payload.password, user.password_hash):
        if user:
            user.failed_attempts += 1
            if user.failed_attempts >= settings.max_failed_attempts:
                user.locked_until = now() + timedelta(minutes=settings.lock_minutes)
                user.failed_attempts = 0
                write_audit(
                    db, None, "AUTH_LOGIN_LOCK", "sys_user", user.id,
                    f"{user.display_name} 连续登录失败达上限，锁定 {settings.lock_minutes} 分钟", ip=client_ip,
                )
                db.commit()
                raise BizError(f"连续输错密码次数过多，账号已锁定 {settings.lock_minutes} 分钟", ErrorCode.VALIDATION)
            remain = settings.max_failed_attempts - user.failed_attempts
            write_audit(db, None, "AUTH_LOGIN_FAIL", "sys_user", user.id, f"{user.display_name} 密码错误", ip=client_ip)
            db.commit()
            raise BizError(f"用户名或密码错误，还可尝试 {remain} 次", ErrorCode.VALIDATION)
        db.commit()
        raise BizError("用户名或密码错误", ErrorCode.VALIDATION)

    if user.status != "active":
        raise BizError("账号已停用，请联系管理员")

    user.failed_attempts = 0
    user.locked_until = None
    user.last_login_at = now()
    user.last_login_ip = client_ip
    result = _issue(db, user)
    write_audit(db, None, "AUTH_LOGIN", "sys_user", user.id, f"{user.display_name} 登录", ip=client_ip)
    db.commit()
    return ok(result)


@router.post("/auth/refresh", summary="刷新访问令牌")
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    record = db.scalar(select(SysRefreshToken).where(SysRefreshToken.token == payload.refreshToken))
    if not record or record.revoked_at is not None or record.expires_at < now():
        raise AuthError("刷新凭证已失效，请重新登录")
    user = db.get(SysUser, record.user_id)
    if not user or user.status != "active":
        raise AuthError()
    record.revoked_at = now()
    result = _issue(db, user)
    db.commit()
    return ok(result)


@router.post("/auth/logout", summary="退出登录")
def logout(payload: RefreshRequest | None = None, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload and payload.refreshToken:
        record = db.scalar(select(SysRefreshToken).where(SysRefreshToken.token == payload.refreshToken))
        if record:
            record.revoked_at = now()
    db.commit()
    return ok(True)


@router.get("/auth/currentUser", summary="获取当前登录用户")
def current_user(user: CurrentUser = Depends(get_current_user)):
    return ok(_user_payload(user))


@router.get("/currentUser", summary="获取当前登录用户，兼容路径")
def current_user_alias(user: CurrentUser = Depends(get_current_user)):
    return ok(_user_payload(user))


@router.post("/auth/password", summary="修改本人密码")
def change_password(payload: PasswordChangeRequest, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.get(SysUser, user.id)
    if not record or not verify_password(payload.oldPassword, record.password_hash):
        raise BizError("原密码不正确")
    problem = check_password_strength(payload.newPassword, record.username)
    if problem:
        raise BizError(problem)
    if verify_password(payload.newPassword, record.password_hash):
        raise BizError("新密码不能与当前密码相同")
    record.password_hash = hash_password(payload.newPassword)
    record.must_change_pwd = False
    revoked = 0
    for token in db.scalars(
        select(SysRefreshToken).where(
            SysRefreshToken.user_id == user.id, SysRefreshToken.revoked_at.is_(None)
        )
    ):
        token.revoked_at = now()
        revoked += 1
    write_audit(
        db, user, "AUTH_PASSWORD_CHANGE", "sys_user", user.id,
        f"修改本人密码，同时吊销 {revoked} 个已有登录凭证",
    )
    db.commit()
    return ok(True)


@router.post("/auth/reset-password", summary="管理员重置他人密码")
def reset_password(user_id: int, new_password: str | None = None, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    record = db.get(SysUser, user_id)
    if not record:
        raise NotFoundError("用户不存在")
    record.password_hash = hash_password(new_password or settings.default_password)
    record.must_change_pwd = True
    write_audit(db, admin, "AUTH_PASSWORD_RESET", "sys_user", user_id, f"重置 {record.display_name} 的密码")
    db.commit()
    return ok(True)
