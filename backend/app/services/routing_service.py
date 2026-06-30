import json
from pathlib import Path
from typing import Any


class RoutingService:
    """Resolves business routing metadata for classifier intents from JSON config."""

    def __init__(self, config_path: Path) -> None:
        self.config_path = config_path
        self._routes = self._load_routes()

    def route(self, intent: str) -> dict[str, Any]:
        route = self._routes.get(intent)
        if route is None:
            raise ValueError(f"No routing rule found for intent '{intent}'.")

        return {
            "department": route["department"],
            "priority": route["priority"],
            "sla_minutes": route["sla_minutes"],
        }

    def _load_routes(self) -> dict[str, dict[str, Any]]:
        with self.config_path.open("r", encoding="utf-8") as config_file:
            routes = json.load(config_file)

        if not isinstance(routes, dict):
            raise ValueError("Routing configuration must be a JSON object.")

        return routes
