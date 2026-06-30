from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.schemas import EmailDetailResponse, EmailFilters, EmailListResponse
from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/emails", tags=["Emails"])

dashboard_service = DashboardService()


@router.get("", response_model=EmailListResponse)
def list_emails(
    intent: str | None = Query(default=None),
    department: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> EmailListResponse:
    filters = EmailFilters(
        intent=intent,
        department=department,
        search=search,
        page=page,
        page_size=page_size,
    )
    return dashboard_service.list_emails(db, filters)


@router.get("/{email_id}", response_model=EmailDetailResponse)
def get_email(email_id: int, db: Session = Depends(get_db)) -> EmailDetailResponse:
    email = dashboard_service.get_email_detail(db, email_id)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found.",
        )

    return email
