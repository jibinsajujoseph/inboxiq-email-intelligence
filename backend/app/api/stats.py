from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.schemas import StatsResponse
from app.services.dashboard_service import DashboardService


router = APIRouter(tags=["Stats"])


def get_dashboard_service(request: Request) -> DashboardService:
    return request.app.state.dashboard_service


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> StatsResponse:
    return dashboard_service.get_stats(db)
