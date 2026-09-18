from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, require_admin
from app.core.response import ok, page
from app.db.session import get_db
from app.schemas.employee import EmployeeBatchTag, EmployeeCreate, EmployeeStatusUpdate, EmployeeUpdate
from app.services import employee_service
from app.utils.pagination import PageParams, page_params

router = APIRouter(tags=["员工档案"])


@router.get("/employees", summary="员工分页列表")
def list_employees(
    params: PageParams = Depends(page_params),
    employmentStatus: str | None = Query(None),
    tagIds: str | None = Query(None),
    leadUserId: int | None = Query(None),
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total = employee_service.list_employees(
        db,
        params,
        employment_status=employmentStatus,
        tag_ids=employee_service.parse_id_list(tagIds),
        lead_user_id=leadUserId,
    )
    return page(items, total, params.current, params.page_size)


@router.get("/employees/options", summary="在职员工下拉选项")
def employee_options(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(employee_service.employee_options(db))


@router.get("/employees/lead-options", summary="编辑主管下拉选项")
def lead_options(admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    return ok(employee_service.lead_options(db))


@router.post("/employees", summary="新建员工")
def create_employee(
    payload: EmployeeCreate,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(employee_service.create_employee(db, payload, admin))


@router.put("/employees/batch-tag", summary="批量打标签")
def batch_tag(
    payload: EmployeeBatchTag,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(employee_service.batch_tag(db, payload, admin))


@router.put("/employees/{employee_id}", summary="编辑员工")
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(employee_service.update_employee(db, employee_id, payload, admin))


@router.put("/employees/{employee_id}/status", summary="变更在职状态")
def update_status(
    employee_id: int,
    payload: EmployeeStatusUpdate,
    admin: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ok(employee_service.update_status(db, employee_id, payload, admin))
