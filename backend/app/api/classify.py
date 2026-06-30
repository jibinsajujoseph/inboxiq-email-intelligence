import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.models.schemas import ClassificationResponse, ClassifyRequest
from app.services.classifier_service import ClassifierService


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Classification"])


def get_classifier_service(request: Request) -> ClassifierService:
    classifier_service = getattr(request.app.state, "classifier_service", None)
    if classifier_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Classifier service is not available.",
        )

    return classifier_service


@router.post("/classify", response_model=ClassificationResponse)
def classify_email(
    payload: ClassifyRequest,
    classifier_service: ClassifierService = Depends(get_classifier_service),
) -> ClassificationResponse:
    """Classify email content without touching Gmail or the database."""
    try:
        result = classifier_service.classify(payload.as_classifier_input())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Classifier request failed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Classifier service is not ready.",
        ) from exc

    return ClassificationResponse(**result)
