from app.core.constants import ErrorCode, ShowType


class BizError(Exception):
    def __init__(self, message: str, error_code: int = ErrorCode.VALIDATION, show_type: int = ShowType.ERROR, data=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.show_type = show_type
        self.data = data


class AuthError(BizError):
    def __init__(self, message: str = "登录状态已失效，请重新登录"):
        super().__init__(message, ErrorCode.UNAUTHORIZED, ShowType.REDIRECT)


class PermissionError_(BizError):
    def __init__(self, message: str = "没有权限执行此操作"):
        super().__init__(message, ErrorCode.FORBIDDEN, ShowType.ERROR)


class NotFoundError(BizError):
    def __init__(self, message: str = "记录不存在"):
        super().__init__(message, ErrorCode.NOT_FOUND, ShowType.ERROR)


class StateConflictError(BizError):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.STATE_CONFLICT, ShowType.ERROR)
