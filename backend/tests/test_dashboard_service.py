import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models.orm import Email, Prediction
from app.models.schemas import OUT_OF_SCOPE_INTENT, ReviewRequest
from app.services.dashboard_service import DashboardService


class StubConfidenceService:
    def get_tier(self, confidence: float | None) -> str:
        if confidence is None:
            return "manual_review"
        if confidence >= 0.9:
            return "auto_routed"
        if confidence >= 0.7:
            return "needs_review"
        return "manual_review"


class StubRoutingService:
    def route(self, intent: str) -> dict:
        routes = {
            "bug_report": {
                "department": "Engineering",
                "priority": "High",
                "sla_minutes": 60,
            },
            "security_concern": {
                "department": "Security",
                "priority": "Critical",
                "sla_minutes": 15,
            },
        }
        route = routes.get(intent)
        if route is None:
            raise ValueError(f"No routing rule found for intent '{intent}'.")
        return route


class DashboardServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        self.service = DashboardService(
            confidence_service=StubConfidenceService(),
            routing_service=StubRoutingService(),
        )

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_review_email_re_routes_known_intent_corrections(self) -> None:
        with self.session_factory() as db:
            email = Email(
                gmail_message_id="message-1",
                thread_id="thread-1",
                sender="user@example.com",
                subject="App keeps crashing",
                body="The upload page freezes.",
                received_at=datetime(2026, 7, 2, 11, 26, 0),
            )
            email.prediction = Prediction(
                intent="bug_report",
                confidence=0.74,
                top3=[
                    {"intent": "bug_report", "confidence": 0.74},
                    {"intent": "security_concern", "confidence": 0.14},
                ],
                department="Engineering",
                priority="High",
                sla_minutes=60,
            )
            db.add(email)
            db.commit()

            result = self.service.review_email(
                db,
                email.id,
                ReviewRequest(corrected_intent="security_concern"),
            )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.prediction.intent, "security_concern")
        self.assertEqual(result.department, "Security")
        self.assertEqual(result.priority, "Critical")
        self.assertEqual(result.sla_minutes, 15)
        self.assertTrue(result.reviewed)
        self.assertTrue(result.was_corrected)
        self.assertEqual(result.original_intent, "bug_report")

    def test_review_email_routes_out_of_scope_to_manual_triage(self) -> None:
        with self.session_factory() as db:
            email = Email(
                gmail_message_id="message-2",
                thread_id="thread-2",
                sender="user@example.com",
                subject="General partnership inquiry",
                body="Can your team help us evaluate a reseller deal?",
                received_at=datetime(2026, 7, 2, 11, 28, 0),
            )
            email.prediction = Prediction(
                intent="bug_report",
                confidence=0.41,
                top3=[
                    {"intent": "bug_report", "confidence": 0.41},
                    {"intent": "feature_request", "confidence": 0.27},
                ],
                department="Engineering",
                priority="High",
                sla_minutes=60,
            )
            db.add(email)
            db.commit()

            result = self.service.review_email(
                db,
                email.id,
                ReviewRequest(corrected_intent=OUT_OF_SCOPE_INTENT),
            )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.prediction.intent, OUT_OF_SCOPE_INTENT)
        self.assertEqual(result.department, "Manual Triage")
        self.assertEqual(result.priority, "Needs Review")
        self.assertIsNone(result.sla_minutes)
        self.assertTrue(result.reviewed)
        self.assertTrue(result.was_corrected)
        self.assertEqual(result.original_intent, "bug_report")


if __name__ == "__main__":
    unittest.main()
