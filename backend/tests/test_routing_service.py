import json
import tempfile
import unittest
from pathlib import Path

from app.services.routing_service import RoutingService


class RoutingServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "routing.json"
        self.config_path.write_text(
            json.dumps(
                {
                    "security_concern": {
                        "department": "Security",
                        "priority": "Critical",
                        "sla_minutes": 15,
                    },
                    "bug_report": {
                        "department": "Engineering",
                        "priority": "High",
                        "sla_minutes": 60,
                    },
                }
            ),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_route_returns_expected_business_mapping(self) -> None:
        service = RoutingService(self.config_path)

        result = service.route("security_concern")

        self.assertEqual(
            result,
            {
                "department": "Security",
                "priority": "Critical",
                "sla_minutes": 15,
            },
        )

    def test_route_raises_for_unknown_intent(self) -> None:
        service = RoutingService(self.config_path)

        with self.assertRaisesRegex(ValueError, "No routing rule found"):
            service.route("missing_intent")


if __name__ == "__main__":
    unittest.main()
