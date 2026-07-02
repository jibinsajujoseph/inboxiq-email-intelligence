import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models.orm import Email, Prediction
from app.services.gmail_service import GmailEmail
from app.services.sync_service import SyncService


class StubGmailService:
    def __init__(self, inbox_message_ids: list[str], messages: dict[str, GmailEmail] | None = None) -> None:
        self.inbox_message_ids = inbox_message_ids
        self.messages = messages or {}

    def has_active_credentials(self, db) -> bool:
        return True

    def build_client(self, db):
        return object()

    def list_inbox_message_ids(self, service, received_after=None) -> list[str]:
        return list(self.inbox_message_ids)

    def fetch_message(self, service, message_id: str) -> GmailEmail:
        return self.messages[message_id]


class StubClassifierService:
    def classify(self, text: str) -> dict:
        return {
            "intent": "bug_report",
            "confidence": 0.91,
            "top3": [{"intent": "bug_report", "confidence": 0.91}],
        }


class StubRoutingService:
    def route(self, intent: str) -> dict:
        return {
            "department": "Engineering",
            "priority": "High",
            "sla_minutes": 60,
        }


class SyncServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_sync_removes_local_emails_missing_from_gmail_inbox(self) -> None:
        with self.session_factory() as db:
            stale_email = Email(
                gmail_message_id="stale-id",
                thread_id="thread-1",
                sender="stale@example.com",
                subject="Old issue",
                body="This should be removed",
                received_at=datetime(2026, 7, 1, 10, 0, 0),
            )
            stale_email.prediction = Prediction(
                intent="bug_report",
                confidence=0.82,
                top3=[],
                department="Engineering",
                priority="High",
                sla_minutes=60,
            )
            kept_email = Email(
                gmail_message_id="keep-id",
                thread_id="thread-2",
                sender="keep@example.com",
                subject="Still in inbox",
                body="Keep this one",
                received_at=datetime(2026, 7, 1, 11, 0, 0),
            )
            kept_email.prediction = Prediction(
                intent="feature_request",
                confidence=0.77,
                top3=[],
                department="Product",
                priority="Medium",
                sla_minutes=240,
            )
            db.add_all([stale_email, kept_email])
            db.commit()

        service = SyncService(
            session_factory=self.session_factory,
            gmail_service=StubGmailService(inbox_message_ids=["keep-id"]),
            classifier_service=StubClassifierService(),
            routing_service=StubRoutingService(),
        )

        service.sync_new_emails()

        with self.session_factory() as db:
            remaining_ids = {
                row[0] for row in db.query(Email.gmail_message_id).all()
            }
            prediction_email_ids = {
                row[0] for row in db.query(Prediction.email_id).all()
            }

        self.assertEqual(remaining_ids, {"keep-id"})
        self.assertEqual(len(prediction_email_ids), 1)

    def test_sync_adds_new_emails_found_in_gmail_inbox(self) -> None:
        gmail_email = GmailEmail(
            gmail_message_id="new-id",
            thread_id="thread-3",
            sender="new@example.com",
            subject="New inbox message",
            body="Please help with the dashboard",
            received_at=datetime(2026, 7, 2, 9, 30, 0, tzinfo=timezone.utc),
        )
        service = SyncService(
            session_factory=self.session_factory,
            gmail_service=StubGmailService(
                inbox_message_ids=["new-id"],
                messages={"new-id": gmail_email},
            ),
            classifier_service=StubClassifierService(),
            routing_service=StubRoutingService(),
        )

        service.sync_new_emails()

        with self.session_factory() as db:
            email = db.query(Email).filter(Email.gmail_message_id == "new-id").first()
            prediction = db.query(Prediction).filter(Prediction.email_id == email.id).first()

        self.assertIsNotNone(email)
        self.assertIsNotNone(prediction)
        self.assertEqual(email.subject, "New inbox message")
        self.assertEqual(prediction.intent, "bug_report")


if __name__ == "__main__":
    unittest.main()
