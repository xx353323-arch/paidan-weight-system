from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.response import ok, register_exception_handlers
from app.db.base import Base
from app.db.seed import seed_all
from app.db.session import SessionLocal, engine


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", docs_url="/docs")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/api/health", tags=["系统"], summary="健康检查")
    def health():
        return ok({"status": "up", "app": settings.app_name})

    @app.on_event("startup")
    def on_startup():
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_all(db)

    return app


app = create_app()
