import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings
from app.core.errors import AuthError


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, username: str) -> tuple[str, int]:
    expires_in = settings.access_token_hours * 3600
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise AuthError("登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise AuthError()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


WEAK_PASSWORDS = {
    "12345678", "123456789", "1234567890", "password", "passw0rd",
    "qwerty123", "abc123456", "11111111", "88888888", "00000000",
}


def check_password_strength(password: str, username: str = "") -> str | None:
    from app.core.config import settings

    if len(password) < settings.password_min_length:
        return f"密码至少需要 {settings.password_min_length} 位"
    if username and password.lower() == username.lower():
        return "密码不能与账号相同"
    if password.lower() in WEAK_PASSWORDS:
        return "这个密码过于常见，容易被猜到，请换一个"
    if not settings.require_strong_password:
        return None
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_letter and has_digit):
        return "密码需要同时包含字母和数字"
    if len(set(password)) < 4:
        return "密码重复字符过多，请换一个"
    return None
