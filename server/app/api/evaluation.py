from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_rater
from app.core.response import ok, page
from app.db.session import get_db
from app.schemas.evaluation import DraftSaveRequest, SubmitRequest, UnknownRequest, WithdrawRequest
from app.services import evaluation_service
from app.utils.pagination import PageParams, page_params

router = APIRouter(prefix="/evaluation", tags=["打分端"])


@router.get("/tasks", summary="我的待评任务")
def my_tasks(
    periodId: int | None = Query(None),
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    return ok(evaluation_service.build_tasks(db, user, periodId))


@router.put("/draft", summary="保存评分草稿")
def save_draft(
    payload: DraftSaveRequest,
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    result = evaluation_service.save_draft(db, user, payload.periodId, payload.records)
    db.commit()
    return ok(result)


@router.post("/submit", summary="提交评分")
def submit(
    payload: SubmitRequest,
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    result = evaluation_service.submit(db, user, payload.periodId, payload.records)
    db.commit()
    return ok(result)


@router.post("/unknown", summary="批量标记不了解")
def mark_unknown(
    payload: UnknownRequest,
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    result = evaluation_service.mark_unknown(db, user, payload.periodId, payload.employeeIds, payload.reason)
    db.commit()
    return ok(result)


@router.post("/withdraw", summary="撤回已提交评分")
def withdraw(
    payload: WithdrawRequest,
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    result = evaluation_service.withdraw(db, user, payload.periodId, payload.employeeIds)
    db.commit()
    return ok(result)


@router.get("/history", summary="我的历史提交")
def history(
    periodId: int | None = Query(None),
    params: PageParams = Depends(page_params),
    user: CurrentUser = Depends(require_rater),
    db: Session = Depends(get_db),
):
    items, total = evaluation_service.history(db, user, periodId, params)
    return page(items, total, params.current, params.page_size)
