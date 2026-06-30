from datetime import datetime, timezone
from math import ceil

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.orm import Email, Prediction
from app.models.schemas import (
    ClassificationResponse,
    CountByLabel,
    EmailDetailResponse,
    EmailFilters,
    EmailListItem,
    EmailListResponse,
    EmailPredictionSummary,
    PaginationMeta,
    ReviewRequest,
    ReviewResponse,
    StatsResponse,
    TopPrediction,
)
from app.services.confidence_service import ConfidenceService
from app.services.routing_service import RoutingService


class DashboardService:
    """Provides filtered email retrieval, dashboard aggregates, and review actions."""

    def __init__(
        self,
        confidence_service: ConfidenceService,
        routing_service: RoutingService,
    ) -> None:
        self.confidence_service = confidence_service
        self.routing_service = routing_service

    def list_emails(self, db: Session, filters: EmailFilters) -> EmailListResponse:
        query = db.query(Email).outerjoin(Prediction).options(joinedload(Email.prediction))
        query = self._apply_filters(query, filters)
        total_query = db.query(func.count(Email.id)).outerjoin(Prediction)
        total_query = self._apply_filters(total_query, filters)

        total = total_query.scalar() or 0
        total_pages = ceil(total / filters.page_size) if total else 0

        order_criteria = [Email.received_at.desc(), Email.id.desc()]
        if filters.review_status in {"needs_review", "manual_review", "unreviewed"}:
            order_criteria = [Prediction.confidence.asc(), Email.received_at.desc()]

        emails = (
            query.order_by(*order_criteria)
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
            .all()
        )

        items = [
            EmailListItem(
                id=email.id,
                sender=email.sender,
                subject=email.subject,
                received_at=email.received_at,
                prediction=EmailPredictionSummary(
                    intent=email.prediction.intent if email.prediction else None,
                    confidence=email.prediction.confidence if email.prediction else None,
                    confidence_tier=(
                        self.confidence_service.get_tier(email.prediction.confidence)
                        if email.prediction
                        else None
                    ),
                    top3=(
                        [TopPrediction(**item) for item in (email.prediction.top3 or [])]
                        if email.prediction
                        else None
                    ),
                    department=email.prediction.department if email.prediction else None,
                    priority=email.prediction.priority if email.prediction else None,
                    sla_minutes=email.prediction.sla_minutes if email.prediction else None,
                    reviewed=email.prediction.reviewed if email.prediction else False,
                    was_corrected=email.prediction.was_corrected if email.prediction else False,
                ),
            )
            for email in emails
        ]

        return EmailListResponse(
            items=items,
            pagination=PaginationMeta(
                page=filters.page,
                page_size=filters.page_size,
                total=total,
                total_pages=total_pages,
            ),
        )

    def get_email_detail(self, db: Session, email_id: int) -> EmailDetailResponse | None:
        email = (
            db.query(Email)
            .options(joinedload(Email.prediction))
            .filter(Email.id == email_id)
            .first()
        )
        if email is None:
            return None

        prediction = email.prediction
        return EmailDetailResponse(
            id=email.id,
            gmail_message_id=email.gmail_message_id,
            thread_id=email.thread_id,
            sender=email.sender,
            subject=email.subject,
            body=email.body,
            received_at=email.received_at,
            created_at=email.created_at,
            prediction=(
                ClassificationResponse(
                    intent=prediction.intent,
                    confidence=prediction.confidence,
                    top3=[TopPrediction(**item) for item in (prediction.top3 or [])],
                )
                if prediction
                else None
            ),
            department=prediction.department if prediction else None,
            priority=prediction.priority if prediction else None,
            sla_minutes=prediction.sla_minutes if prediction else None,
            processed_at=prediction.processed_at if prediction else None,
            confidence_tier=(
                self.confidence_service.get_tier(prediction.confidence)
                if prediction
                else None
            ),
            reviewed=prediction.reviewed if prediction else False,
            reviewed_at=prediction.reviewed_at if prediction else None,
            original_intent=prediction.original_intent if prediction else None,
            was_corrected=prediction.was_corrected if prediction else False,
        )

    def review_email(
        self, db: Session, email_id: int, review: ReviewRequest
    ) -> ReviewResponse | None:
        """Mark a prediction as reviewed, optionally correcting the intent."""
        email = (
            db.query(Email)
            .options(joinedload(Email.prediction))
            .filter(Email.id == email_id)
            .first()
        )
        if email is None or email.prediction is None:
            return None

        prediction = email.prediction

        # Handle optional intent correction
        if (
            review.corrected_intent is not None
            and review.corrected_intent != prediction.intent
        ):
            prediction.original_intent = prediction.intent
            prediction.intent = review.corrected_intent
            prediction.was_corrected = True

            # Re-run routing to update department/priority/SLA
            routing_result = self.routing_service.route(review.corrected_intent)
            prediction.department = routing_result["department"]
            prediction.priority = routing_result["priority"]
            prediction.sla_minutes = routing_result["sla_minutes"]

        # Always mark as reviewed
        prediction.reviewed = True
        prediction.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)

        db.commit()
        db.refresh(prediction)
        db.refresh(email)

        return ReviewResponse(
            id=email.id,
            gmail_message_id=email.gmail_message_id,
            sender=email.sender,
            subject=email.subject,
            intent=prediction.intent,
            confidence=prediction.confidence,
            confidence_tier=self.confidence_service.get_tier(prediction.confidence),
            department=prediction.department,
            priority=prediction.priority,
            sla_minutes=prediction.sla_minutes,
            reviewed=prediction.reviewed,
            reviewed_at=prediction.reviewed_at,
            original_intent=prediction.original_intent,
            was_corrected=prediction.was_corrected,
        )

    def get_stats(self, db: Session) -> StatsResponse:
        total_emails = db.query(func.count(Email.id)).scalar() or 0
        avg_confidence = db.query(func.avg(Prediction.confidence)).scalar() or 0.0

        by_intent_rows = (
            db.query(Prediction.intent, func.count(Prediction.id))
            .group_by(Prediction.intent)
            .order_by(func.count(Prediction.id).desc(), Prediction.intent.asc())
            .all()
        )
        by_department_rows = (
            db.query(Prediction.department, func.count(Prediction.id))
            .group_by(Prediction.department)
            .order_by(func.count(Prediction.id).desc(), Prediction.department.asc())
            .all()
        )

        # Compute review counts dynamically from thresholds
        thresholds = self.confidence_service.get_thresholds()
        high = thresholds["high_confidence_threshold"]
        low = thresholds["needs_review_threshold"]

        needs_review_count = (
            db.query(func.count(Prediction.id))
            .filter(
                and_(
                    Prediction.confidence >= low,
                    Prediction.confidence < high,
                    Prediction.reviewed == False,
                )
            )
            .scalar()
            or 0
        )

        manual_review_count = (
            db.query(func.count(Prediction.id))
            .filter(
                and_(
                    Prediction.confidence < low,
                    Prediction.reviewed == False,
                )
            )
            .scalar()
            or 0
        )

        unreviewed_count = needs_review_count + manual_review_count

        return StatsResponse(
            total_emails=total_emails,
            avg_confidence=float(avg_confidence),
            by_intent=[
                CountByLabel(label=intent or "unknown", count=count)
                for intent, count in by_intent_rows
            ],
            by_department=[
                CountByLabel(label=department or "unknown", count=count)
                for department, count in by_department_rows
            ],
            needs_review_count=needs_review_count,
            manual_review_count=manual_review_count,
            unreviewed_count=unreviewed_count,
        )

    def _apply_filters(self, query, filters: EmailFilters):
        if filters.intent:
            query = query.filter(Prediction.intent == filters.intent)

        if filters.department:
            query = query.filter(Prediction.department == filters.department)

        if filters.search:
            search_term = f"%{filters.search.strip()}%"
            query = query.filter(
                or_(
                    Email.subject.ilike(search_term),
                    Email.body.ilike(search_term),
                    Email.sender.ilike(search_term),
                )
            )

        if filters.review_status and filters.review_status != "all":
            query = self._apply_review_status_filter(query, filters.review_status)

        return query

    def _apply_review_status_filter(self, query, review_status: str):
        """Translate a review_status value into confidence-range + reviewed SQL filters."""
        thresholds = self.confidence_service.get_thresholds()
        high = thresholds["high_confidence_threshold"]
        low = thresholds["needs_review_threshold"]

        if review_status == "needs_review":
            query = query.filter(
                and_(
                    Prediction.confidence >= low,
                    Prediction.confidence < high,
                    Prediction.reviewed == False,
                )
            )
        elif review_status == "manual_review":
            query = query.filter(
                and_(
                    Prediction.confidence < low,
                    Prediction.reviewed == False,
                )
            )
        elif review_status == "unreviewed":
            query = query.filter(
                and_(
                    Prediction.confidence < high,
                    Prediction.reviewed == False,
                )
            )
        elif review_status == "reviewed":
            query = query.filter(Prediction.reviewed == True)

        return query
