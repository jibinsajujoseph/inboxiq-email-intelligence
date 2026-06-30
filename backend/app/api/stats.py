from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.schemas import StatsResponse
from app.services.dashboard_service import DashboardService


router = APIRouter(tags=["Stats"])

dashboard_service = DashboardService()


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    return dashboard_service.get_stats(db)
