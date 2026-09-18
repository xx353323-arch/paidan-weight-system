from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)
    autoLogin: bool = True


class RefreshRequest(BaseModel):
    refreshToken: str


class PasswordChangeRequest(BaseModel):
    oldPassword: str | None = None
    newPassword: str = Field(min_length=1, max_length=64)


class LoginResult(BaseModel):
    token: str
    refreshToken: str
    expiresIn: int
    mustChangePassword: bool


class CurrentUserResult(BaseModel):
    userid: str
    name: str
    username: str
    access: str
    roles: list[str]
    raterRoles: list[str]
    coverageModes: dict[str, str]
