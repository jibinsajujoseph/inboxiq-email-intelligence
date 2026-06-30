from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.schemas import (
    EmailDetailResponse,
    EmailFilters,
    EmailListResponse,
    ReviewRequest,
    ReviewResponse,
    VALID_REVIEW_STATUSES,
)
from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/emails", tags=["Emails"])


def get_dashboard_service(request: Request) -> DashboardService:
    return request.app.state.dashboard_service


@router.get("", response_model=EmailListResponse)
def list_emails(
    intent: str | None = Query(default=None),
    department: str | None = Query(default=None),
    search: str | None = Query(default=None),
    review_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> EmailListResponse:
    if review_status is not None and review_status not in VALID_REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid review_status. Must be one of: {', '.join(sorted(VALID_REVIEW_STATUSES))}",
        )

    filters = EmailFilters(
        intent=intent,
        department=department,
        search=search,
        review_status=review_status,
        page=page,
        page_size=page_size,
    )
    return dashboard_service.list_emails(db, filters)


@router.get("/{email_id}", response_model=EmailDetailResponse)
def get_email(
    email_id: int,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> EmailDetailResponse:
    email = dashboard_service.get_email_detail(db, email_id)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found.",
        )

    return email


@router.patch("/{email_id}/review", response_model=ReviewResponse)
def review_email(
    email_id: int,
    review: ReviewRequest | None = None,
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> ReviewResponse:
    if review is None:
        review = ReviewRequest()

    result = dashboard_service.review_email(db, email_id, review)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email or prediction not found.",
        )

    return result
