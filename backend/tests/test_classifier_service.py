import unittest
from unittest.mock import patch

from app.services.classifier_service import ClassifierService


class ClassifierServiceTestCase(unittest.TestCase):
    def test_load_initializes_pipeline_once(self) -> None:
        fake_pipeline = object()

        with patch(
            "app.services.classifier_service.build_text_classification_pipeline",
            return_value=fake_pipeline,
        ) as pipeline_mock:
            service = ClassifierService("demo-model")

            service.load()
            service.load()

        self.assertIs(service._pipeline, fake_pipeline)
        pipeline_mock.assert_called_once_with("demo-model")

    def test_classify_normalizes_label_formats_and_top3(self) -> None:
        service = ClassifierService("demo-model")
        service._pipeline = lambda text, truncation=True: [
            {"label": "LABEL_3", "score": 0.91},
            {"label": "feature_request", "score": 0.06},
            {"label": "0", "score": 0.03},
        ]

        result = service.classify("Subject: App crash\n\nThe dashboard fails after login.")

        self.assertEqual(result["intent"], "bug_report")
        self.assertAlmostEqual(result["confidence"], 0.91)
        self.assertEqual(
            result["top3"],
            [
                {"intent": "bug_report", "confidence": 0.91},
                {"intent": "feature_request", "confidence": 0.06},
                {"intent": "login_issue", "confidence": 0.03},
            ],
        )

    def test_classify_accepts_nested_pipeline_output(self) -> None:
        service = ClassifierService("demo-model")
        service._pipeline = lambda text, truncation=True: [[
            {"label": "LABEL_7", "score": 0.88},
            {"label": "LABEL_3", "score": 0.08},
            {"label": "LABEL_6", "score": 0.04},
        ]]

        result = service.classify("Subject: Security concern\n\nWe noticed suspicious activity.")

        self.assertEqual(result["intent"], "security_concern")
        self.assertEqual(len(result["top3"]), 3)

    def test_classify_rejects_empty_text(self) -> None:
        service = ClassifierService("demo-model")
        service._pipeline = lambda text, truncation=True: []

        with self.assertRaisesRegex(ValueError, "cannot be empty"):
            service.classify("   ")

    def test_classify_requires_loaded_pipeline(self) -> None:
        service = ClassifierService("demo-model")

        with self.assertRaisesRegex(RuntimeError, "has not been loaded"):
            service.classify("Subject: Help\n\nPlease assist.")

    def test_classify_rejects_unknown_label(self) -> None:
        service = ClassifierService("demo-model")
        service._pipeline = lambda text, truncation=True: [
            {"label": "LABEL_99", "score": 1.0},
        ]

        with self.assertRaisesRegex(ValueError, "Unsupported model label"):
            service.classify("Subject: Unknown\n\nUnexpected label format.")


if __name__ == "__main__":
    unittest.main()
