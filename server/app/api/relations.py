from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, require_admin
from app.core.response import ok
from app.db.session import get_db
from app.schemas.relation import CopyFromLastRequest, TargetSaveRequest
from app.services import relation_service

router = APIRouter(prefix="/relations", tags=["评价关系"])


@router.get("/raters", summary="评价人列表")
def list_raters(admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    return ok(relation_service.list_raters(db))


@router.get("/matrix", summary="评价关系总览矩阵")
def relation_matrix(admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    return ok(relation_service.build_matrix(db))


@router.get("/coverage-check", summary="跑批前覆盖度检查")
def coverage_check(admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    return ok(relation_service.coverage_check(db))


@router.post("/copy-from-last", summary="从上一周期复制评价关系")
def copy_from_last(
    payload: CopyFromLastRequest | None = None,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(relation_service.copy_from_last(db, admin))


@router.get("/{rater_user_id}/targets", summary="某评价人的覆盖名单")
def get_targets(
    rater_user_id: int,
    roleCode: str | None = Query(None),
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(relation_service.get_targets(db, rater_user_id, roleCode))


@router.put("/{rater_user_id}/targets", summary="保存某评价人的覆盖名单")
def save_targets(
    rater_user_id: int,
    payload: TargetSaveRequest,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = relation_service.save_targets(
        db,
        admin,
        rater_user_id,
        payload.roleCode,
        payload.targetIds,
        payload.coverageMode,
    )
    return ok(result)
