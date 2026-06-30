import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, classify, emails, stats
from app.config.settings import settings
from app.db.session import SessionLocal, enable_sqlite_wal_mode
from app.services.classifier_service import ClassifierService
from app.services.confidence_service import ConfidenceService
from app.services.dashboard_service import DashboardService
from app.services.gmail_service import GmailService
from app.services.routing_service import RoutingService
from app.services.sync_service import SyncService
from apscheduler.schedulers.background import BackgroundScheduler


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    enable_sqlite_wal_mode()

    classifier_service = ClassifierService(settings.HF_MODEL)
    classifier_service.load()
    routing_service = RoutingService(settings.ROUTING_CONFIG_PATH)
    confidence_service = ConfidenceService(settings.CONFIDENCE_CONFIG_PATH)
    gmail_service = GmailService()
    dashboard_service = DashboardService(
        confidence_service=confidence_service,
        routing_service=routing_service,
    )
    scheduler = BackgroundScheduler(timezone="UTC")

    def stop_gmail_sync_job() -> None:
        if scheduler.get_job("gmail-sync") is None:
            return
        scheduler.remove_job("gmail-sync")
        logging.getLogger(__name__).warning(
            "Removed Gmail sync job because reauthorization is required."
        )

    sync_service = SyncService(
        session_factory=SessionLocal,
        gmail_service=gmail_service,
        classifier_service=classifier_service,
        routing_service=routing_service,
        on_reauth_required=stop_gmail_sync_job,
    )
    scheduler.add_job(
        sync_service.sync_new_emails,
        trigger="interval",
        seconds=settings.GMAIL_POLL_INTERVAL_SECONDS,
        id="gmail-sync",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        next_run_time=datetime.now(timezone.utc),
    )
    scheduler.start()

    app.state.classifier_service = classifier_service
    app.state.routing_service = routing_service
    app.state.confidence_service = confidence_service
    app.state.dashboard_service = dashboard_service
    app.state.gmail_service = gmail_service
    app.state.sync_service = sync_service
    app.state.scheduler = scheduler
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="InboxIQ MVP API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(classify.router)
app.include_router(emails.router)
app.include_router(stats.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
