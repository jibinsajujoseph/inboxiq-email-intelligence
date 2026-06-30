from math import ceil

from sqlalchemy import func, or_
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
    StatsResponse,
    TopPrediction,
)


class DashboardService:
    """Provides filtered email retrieval and dashboard aggregates."""

    def list_emails(self, db: Session, filters: EmailFilters) -> EmailListResponse:
        query = db.query(Email).outerjoin(Prediction).options(joinedload(Email.prediction))
        query = self._apply_filters(query, filters)
        total_query = db.query(func.count(Email.id)).outerjoin(Prediction)
        total_query = self._apply_filters(total_query, filters)

        total = total_query.scalar() or 0
        total_pages = ceil(total / filters.page_size) if total else 0

        emails = (
            query.order_by(Email.received_at.desc(), Email.id.desc())
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
                    department=email.prediction.department if email.prediction else None,
                    priority=email.prediction.priority if email.prediction else None,
                    sla_minutes=email.prediction.sla_minutes if email.prediction else None,
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

        return query
