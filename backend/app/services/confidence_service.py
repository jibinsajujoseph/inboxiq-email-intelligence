import json
from pathlib import Path
from typing import Any


class ConfidenceService:
    """Loads confidence thresholds from JSON config and computes tiers dynamically."""

    def __init__(self, config_path: Path) -> None:
        self.config_path = config_path
        self._thresholds = self._load_thresholds()

    @property
    def high_confidence_threshold(self) -> float:
        return self._thresholds["high_confidence_threshold"]

    @property
    def needs_review_threshold(self) -> float:
        return self._thresholds["needs_review_threshold"]

    def get_tier(self, confidence: float | None) -> str:
        """Compute the confidence tier dynamically from the current threshold config."""
        if confidence is None:
            return "manual_review"
        if confidence >= self.high_confidence_threshold:
            return "auto_routed"
        if confidence >= self.needs_review_threshold:
            return "needs_review"
        return "manual_review"

    def get_thresholds(self) -> dict[str, float]:
        """Return the current thresholds for use in range queries."""
        return {
            "high_confidence_threshold": self.high_confidence_threshold,
            "needs_review_threshold": self.needs_review_threshold,
        }

    def _load_thresholds(self) -> dict[str, Any]:
        with self.config_path.open("r", encoding="utf-8") as config_file:
            thresholds = json.load(config_file)

        if not isinstance(thresholds, dict):
            raise ValueError("Confidence configuration must be a JSON object.")

        required_keys = {"high_confidence_threshold", "needs_review_threshold"}
        missing = required_keys - set(thresholds.keys())
        if missing:
            raise ValueError(f"Confidence configuration is missing keys: {missing}")

        if thresholds["needs_review_threshold"] >= thresholds["high_confidence_threshold"]:
            raise ValueError(
                "needs_review_threshold must be less than high_confidence_threshold."
            )

        return thresholds
