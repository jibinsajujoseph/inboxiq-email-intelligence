from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClassifyRequest(BaseModel):
    subject: str = Field(default="")
    body: str = Field(default="")

    @model_validator(mode="after")
    def validate_content(self) -> "ClassifyRequest":
        if not self.subject.strip() and not self.body.strip():
            raise ValueError("At least one of subject or body must be provided.")
        return self

    def as_classifier_input(self) -> str:
        return f"Subject: {self.subject.strip()}\n\n{self.body.strip()}".strip()


class TopPrediction(BaseModel):
    intent: str
    confidence: float


class ClassificationResponse(BaseModel):
    intent: str
    confidence: float
    top3: list[TopPrediction]


class EmailPredictionSummary(BaseModel):
    intent: str | None = None
    confidence: float | None = None
    department: str | None = None
    priority: str | None = None
    sla_minutes: int | None = None


class EmailListItem(BaseModel):
    id: int
    sender: str | None = None
    subject: str | None = None
    received_at: datetime | None = None
    prediction: EmailPredictionSummary


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class EmailListResponse(BaseModel):
    items: list[EmailListItem]
    pagination: PaginationMeta


class EmailDetailResponse(BaseModel):
    id: int
    gmail_message_id: str | None = None
    thread_id: str | None = None
    sender: str | None = None
    subject: str | None = None
    body: str | None = None
    received_at: datetime | None = None
    created_at: datetime | None = None
    prediction: ClassificationResponse | None = None
    department: str | None = None
    priority: str | None = None
    sla_minutes: int | None = None
    processed_at: datetime | None = None


class CountByLabel(BaseModel):
    label: str
    count: int


class StatsResponse(BaseModel):
    total_emails: int
    avg_confidence: float
    by_intent: list[CountByLabel]
    by_department: list[CountByLabel]


class EmailFilters(BaseModel):
    intent: str | None = None
    department: str | None = None
    search: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    model_config = ConfigDict(extra="forbid")
