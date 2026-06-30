import logging
from typing import Any

from transformers import pipeline


logger = logging.getLogger(__name__)


LABEL_TO_INTENT: dict[str, str] = {
    "0": "login_issue",
    "1": "billing_refund",
    "2": "subscription_change",
    "3": "bug_report",
    "4": "feature_request",
    "5": "integration_api",
    "6": "performance_issue",
    "7": "security_concern",
}

SUPPORTED_INTENTS = set(LABEL_TO_INTENT.values())


class ClassifierService:
    """Wraps the Hugging Face text-classification pipeline for local inference."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._pipeline = None

    def load(self) -> None:
        """Load the model once and keep it in memory for the life of the process."""
        if self._pipeline is not None:
            return

        logger.info("Loading classifier model '%s'.", self.model_name)
        self._pipeline = pipeline(
            "text-classification",
            model=self.model_name,
            top_k=3,
        )
        logger.info("Classifier model '%s' is ready.", self.model_name)

    def classify(self, text: str) -> dict[str, Any]:
        """Classify a combined subject/body string and return the top prediction set."""
        if not text.strip():
            raise ValueError("Classification text cannot be empty.")
        if self._pipeline is None:
            raise RuntimeError("ClassifierService has not been loaded.")

        raw_predictions = self._pipeline(text, truncation=True)
        predictions = self._normalize_predictions(raw_predictions)
        if not predictions:
            raise RuntimeError("Classifier returned no predictions.")

        return {
            "intent": predictions[0]["intent"],
            "confidence": predictions[0]["confidence"],
            "top3": predictions,
        }

    def _normalize_predictions(self, raw_predictions: Any) -> list[dict[str, float | str]]:
        if isinstance(raw_predictions, list) and raw_predictions and isinstance(raw_predictions[0], list):
            raw_predictions = raw_predictions[0]

        normalized_predictions: list[dict[str, float | str]] = []
        for prediction in raw_predictions:
            normalized_predictions.append(
                {
                    "intent": self._normalize_label(str(prediction["label"])),
                    "confidence": float(prediction["score"]),
                }
            )

        return normalized_predictions

    def _normalize_label(self, label: str) -> str:
        normalized_label = label.strip()
        lowered_label = normalized_label.lower()
        if lowered_label in SUPPORTED_INTENTS:
            return lowered_label

        if normalized_label.upper().startswith("LABEL_"):
            label_id = normalized_label.split("_", maxsplit=1)[1]
            if label_id in LABEL_TO_INTENT:
                return LABEL_TO_INTENT[label_id]

        if normalized_label in LABEL_TO_INTENT:
            return LABEL_TO_INTENT[normalized_label]

        raise ValueError(f"Unsupported model label '{label}'.")
