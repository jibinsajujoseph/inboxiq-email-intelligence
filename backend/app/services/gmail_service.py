import base64
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from html import unescape
from typing import Any

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials as GoogleCredentials
from googleapiclient.discovery import Resource, build
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.orm import Credential
from app.services.crypto_service import crypto_service


logger = logging.getLogger(__name__)

TOKEN_URI = "https://oauth2.googleapis.com/token"
SYNC_LOOKBACK_BUFFER = timedelta(minutes=5)


class ReauthRequiredError(Exception):
    """Raised when the stored Gmail refresh token is no longer valid."""


@dataclass
class GmailEmail:
    gmail_message_id: str
    thread_id: str
    sender: str
    subject: str
    body: str
    received_at: datetime


class GmailService:
    """Handles Gmail API access, token refresh, and message parsing."""

    def build_client(self, db: Session) -> Resource:
        google_credentials = self._refresh_google_credentials(db)
        return build("gmail", "v1", credentials=google_credentials, cache_discovery=False)

    def list_message_ids_since(
        self,
        service: Resource,
        received_after: datetime | None,
    ) -> list[str]:
        query = self._build_query(received_after)

        message_ids: list[str] = []
        page_token: str | None = None
        while True:
            response = (
                service.users()
                .messages()
                .list(
                    userId="me",
                    q=query or None,
                    pageToken=page_token,
                    maxResults=100,
                )
                .execute()
            )

            for message in response.get("messages", []):
                message_id = message.get("id")
                if message_id:
                    message_ids.append(message_id)

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return message_ids

    def fetch_message(self, service: Resource, message_id: str) -> GmailEmail:
        payload = (
            service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )

        headers = self._extract_headers(payload.get("payload", {}))
        subject = headers.get("subject", "")
        sender = parseaddr(headers.get("from", ""))[1] or headers.get("from", "")
        body = self._extract_message_body(payload.get("payload", {}))
        received_at = self._parse_received_at(payload)

        return GmailEmail(
            gmail_message_id=payload["id"],
            thread_id=payload.get("threadId", ""),
            sender=sender,
            subject=subject,
            body=body,
            received_at=received_at,
        )

    def has_active_credentials(self, db: Session) -> bool:
        return (
            db.query(Credential)
            .filter(
                Credential.provider == "gmail",
                Credential.status == "active",
            )
            .first()
            is not None
        )

    def _refresh_google_credentials(self, db: Session) -> GoogleCredentials:
        credential = (
            db.query(Credential)
            .filter(
                Credential.provider == "gmail",
                Credential.status == "active",
            )
            .order_by(Credential.updated_at.desc())
            .first()
        )
        if credential is None:
            raise ReauthRequiredError("No active Gmail credential is stored.")

        refresh_token = crypto_service.decrypt(credential.encrypted_refresh_token)
        google_credentials = GoogleCredentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=TOKEN_URI,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/gmail.readonly"],
        )

        try:
            google_credentials.refresh(Request())
        except RefreshError as exc:
            if "invalid_grant" in str(exc):
                credential.status = "needs_reauth"
                db.commit()
                logger.error(
                    "Stored Gmail refresh token is invalid. Credential marked as needs_reauth."
                )
                raise ReauthRequiredError("Stored Gmail refresh token is invalid.") from exc
            raise

        return google_credentials

    def _build_query(self, received_after: datetime | None) -> str:
        if received_after is None:
            return ""

        if received_after.tzinfo is None:
            received_after = received_after.replace(tzinfo=timezone.utc)

        checkpoint = int(
            (received_after.astimezone(timezone.utc) - SYNC_LOOKBACK_BUFFER).timestamp()
        )
        return f"after:{max(checkpoint, 0)}"

    def _extract_headers(self, payload: dict[str, Any]) -> dict[str, str]:
        headers: dict[str, str] = {}
        for header in payload.get("headers", []):
            name = str(header.get("name", "")).lower()
            value = str(header.get("value", ""))
            if name:
                headers[name] = value
        return headers

    def _extract_message_body(self, payload: dict[str, Any]) -> str:
        plain_text = self._find_body_by_mime_type(payload, "text/plain")
        if plain_text:
            return plain_text.strip()

        html_body = self._find_body_by_mime_type(payload, "text/html")
        if html_body:
            return self._strip_html(html_body).strip()

        return ""

    def _find_body_by_mime_type(self, part: dict[str, Any], mime_type: str) -> str:
        if part.get("mimeType") == mime_type:
            data = part.get("body", {}).get("data")
            if data:
                return self._decode_base64_body(data)

        for child_part in part.get("parts", []) or []:
            body = self._find_body_by_mime_type(child_part, mime_type)
            if body:
                return body

        data = part.get("body", {}).get("data")
        if data and part.get("mimeType") == mime_type:
            return self._decode_base64_body(data)

        return ""

    def _decode_base64_body(self, encoded_body: str) -> str:
        padding = "=" * (-len(encoded_body) % 4)
        decoded_bytes = base64.urlsafe_b64decode(encoded_body + padding)
        return decoded_bytes.decode("utf-8", errors="replace")

    def _strip_html(self, html_body: str) -> str:
        without_tags = re.sub(r"<[^>]+>", " ", html_body)
        normalized = re.sub(r"\s+", " ", without_tags)
        return unescape(normalized)

    def _parse_received_at(self, message: dict[str, Any]) -> datetime:
        internal_date_ms = message.get("internalDate")
        if internal_date_ms:
            return datetime.fromtimestamp(
                int(internal_date_ms) / 1000,
                tz=timezone.utc,
            )

        return datetime.now(timezone.utc)
