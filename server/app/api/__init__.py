from fastapi import APIRouter

from app.api import (
    adjustments,
    auth,
    batch,
    employees,
    evaluation,
    periods,
    public,
    relations,
    tags,
    weights,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(employees.router)
api_router.include_router(tags.router)
api_router.include_router(relations.router)
api_router.include_router(periods.router)
api_router.include_router(batch.router)
api_router.include_router(weights.router)
api_router.include_router(public.router)
api_router.include_router(adjustments.router)
api_router.include_router(evaluation.router)
