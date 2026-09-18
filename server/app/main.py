from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings
from app.core.response import ok, register_exception_handlers
from app.db.base import Base
from app.db.seed import seed_all
from app.db.session import SessionLocal, engine


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None if settings.public_facing else "/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.public_facing:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/api/health", tags=["系统"], summary="健康检查")
    def health():
        return ok({"status": "up", "app": settings.app_name})

    static_root = Path(settings.static_dir) if settings.static_dir else None
    if static_root and static_root.is_dir():
        for sub in ("assets", "static", "scripts"):
            target = static_root / sub
            if target.is_dir():
                app.mount(f"/{sub}", StaticFiles(directory=str(target)), name=sub)

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa_entry(full_path: str):
            candidate = static_root / full_path
            if full_path and candidate.is_file():
                return FileResponse(str(candidate))
            return FileResponse(str(static_root / "index.html"))

    @app.on_event("startup")
    def on_startup():
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_all(db)

    return app


app = create_app()
