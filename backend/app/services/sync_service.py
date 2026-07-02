import logging
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models.orm import Email, Prediction
from app.services.classifier_service import ClassifierService
from app.services.gmail_service import GmailService, ReauthRequiredError
from app.services.routing_service import RoutingService


logger = logging.getLogger(__name__)


class SyncService:
    """Coordinates Gmail ingestion, classification, routing, and persistence."""

    def __init__(
        self,
        session_factory: sessionmaker,
        gmail_service: GmailService,
        classifier_service: ClassifierService,
        routing_service: RoutingService,
        on_reauth_required: Callable[[], None] | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.gmail_service = gmail_service
        self.classifier_service = classifier_service
        self.routing_service = routing_service
        self.on_reauth_required = on_reauth_required

    def sync_new_emails(self) -> None:
        with self.session_factory() as db:
            try:
                if not self.gmail_service.has_active_credentials(db):
                    logger.info("Skipping Gmail sync because no active Gmail credential is available.")
                    return

                gmail_client = self.gmail_service.build_client(db)
                inbox_message_ids = self.gmail_service.list_inbox_message_ids(gmail_client)
                removed_count = self._prune_removed_emails(db, inbox_message_ids)
                if removed_count:
                    logger.info(
                        "Removed %s email(s) that are no longer present in the Gmail inbox.",
                        removed_count,
                    )

                if not inbox_message_ids:
                    logger.debug("No Gmail inbox messages found during reconciliation.")
                    return

                existing_ids = self._get_existing_message_ids(db, inbox_message_ids)
                new_message_ids = [
                    message_id for message_id in inbox_message_ids if message_id not in existing_ids
                ]
                if not new_message_ids:
                    logger.debug("Local InboxIQ store is already aligned with the Gmail inbox.")
                    return

                logger.info("Processing %s new Gmail message(s).", len(new_message_ids))
                for message_id in new_message_ids:
                    self._process_message(db, gmail_client, message_id)
            except ReauthRequiredError:
                if self.on_reauth_required is not None:
                    self.on_reauth_required()
                logger.warning("Stopping current Gmail sync run because reauthorization is required.")
            except Exception:
                logger.exception("Unexpected error during Gmail sync.")

    def _get_existing_message_ids(self, db: Session, message_ids: list[str]) -> set[str]:
        if not message_ids:
            return set()

        rows = (
            db.query(Email.gmail_message_id)
            .filter(Email.gmail_message_id.in_(message_ids))
            .all()
        )
        return {row[0] for row in rows}

    def _prune_removed_emails(self, db: Session, inbox_message_ids: list[str]) -> int:
        stale_query = db.query(Email).filter(Email.gmail_message_id.isnot(None))
        if inbox_message_ids:
            stale_query = stale_query.filter(~Email.gmail_message_id.in_(inbox_message_ids))

        stale_emails = stale_query.all()
        if not stale_emails:
            return 0

        for email in stale_emails:
            db.delete(email)

        db.commit()
        return len(stale_emails)

    def _process_message(self, db: Session, gmail_client, message_id: str) -> None:
        try:
            gmail_email = self.gmail_service.fetch_message(gmail_client, message_id)
            combined_text = f"Subject: {gmail_email.subject}\n\n{gmail_email.body}".strip()
            classification = self.classifier_service.classify(combined_text)
            routing_result = self.routing_service.route(classification["intent"])

            email = Email(
                gmail_message_id=gmail_email.gmail_message_id,
                thread_id=gmail_email.thread_id,
                sender=gmail_email.sender,
                subject=gmail_email.subject,
                body=gmail_email.body,
                received_at=self._as_naive_utc(gmail_email.received_at),
            )
            db.add(email)
            db.flush()

            prediction = Prediction(
                email_id=email.id,
                intent=classification["intent"],
                confidence=classification["confidence"],
                top3=classification["top3"],
                department=routing_result["department"],
                priority=routing_result["priority"],
                sla_minutes=routing_result["sla_minutes"],
                processed_at=self._as_naive_utc(datetime.now(timezone.utc)),
            )
            db.add(prediction)
            db.commit()
        except IntegrityError:
            db.rollback()
            logger.info("Skipped duplicate Gmail message '%s'.", message_id)
        except ReauthRequiredError:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            logger.exception("Failed to process Gmail message '%s'.", message_id)

    def _as_naive_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)
