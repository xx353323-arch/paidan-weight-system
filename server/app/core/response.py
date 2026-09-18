import traceback
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.constants import ErrorCode, ShowType
from app.core.errors import BizError


def ok(data: Any = None) -> dict:
    return {"success": True, "data": data}


def page(items: list, total: int, current: int = 1, page_size: int = 20) -> dict:
    return {"success": True, "data": items, "total": total, "current": current, "pageSize": page_size}


def fail(error_code: int, message: str, show_type: int = ShowType.ERROR, data: Any = None) -> dict:
    return {
        "success": False,
        "data": data,
        "errorCode": error_code,
        "errorMessage": message,
        "showType": show_type,
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BizError)
    def handle_biz(request: Request, exc: BizError):
        return JSONResponse(status_code=200, content=fail(exc.error_code, exc.message, exc.show_type, exc.data))

    @app.exception_handler(RequestValidationError)
    def handle_validation(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        first = errors[0] if errors else {}
        loc = ".".join(str(x) for x in first.get("loc", [])[1:])
        message = f"{loc} {first.get('msg', '参数错误')}".strip()
        detail = [{"field": ".".join(str(x) for x in e.get("loc", [])[1:]), "message": e.get("msg", "")} for e in errors]
        return JSONResponse(status_code=200, content=fail(ErrorCode.VALIDATION, message, ShowType.ERROR, {"fieldErrors": detail}))

    @app.exception_handler(StarletteHTTPException)
    def handle_http(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 401:
            return JSONResponse(status_code=200, content=fail(ErrorCode.UNAUTHORIZED, "登录状态已失效，请重新登录", ShowType.REDIRECT))
        if exc.status_code == 403:
            return JSONResponse(status_code=200, content=fail(ErrorCode.FORBIDDEN, "没有权限执行此操作"))
        if exc.status_code == 404:
            return JSONResponse(status_code=200, content=fail(ErrorCode.NOT_FOUND, "接口不存在"))
        return JSONResponse(status_code=exc.status_code, content=fail(ErrorCode.INTERNAL, str(exc.detail)))

    @app.exception_handler(Exception)
    def handle_unknown(request: Request, exc: Exception):
        traceback.print_exc()
        return JSONResponse(
            status_code=200,
            content=fail(ErrorCode.INTERNAL, "服务器内部错误，请联系管理员查看后台日志"),
        )
