# InboxIQ Architecture

## Overview

InboxIQ is a single-inbox support triage system. One Gmail account is connected once through OAuth, and the backend continues syncing with the stored refresh token. Each new email is classified locally, enriched with business routing metadata, written to the database, and exposed to the frontend dashboard.

## High-Level Flow

```text
Gmail Inbox
   |
   |  APScheduler polling job (~25s)
   v
FastAPI Backend
   |
   +--> GmailService
   |      - refreshes Google access tokens in memory
   |      - lists and fetches Gmail messages
   |      - parses headers and MIME bodies
   |
   +--> ClassifierService
   |      - loads HF_MODEL once at startup
   |      - runs local text classification
   |      - returns top intent + top3 confidence list
   |
   +--> RoutingService
   |      - reads JSON routing rules
   |      - maps intent -> department / priority / SLA
   |
   +--> SyncService
   |      - deduplicates by gmail_message_id
   |      - writes emails + predictions
   |
   +--> Dashboard APIs
          - list emails
          - email detail
          - stats
```

## Backend Components

### `ClassifierService`

- Lives in `backend/app/services/classifier_service.py`
- Loads `transformers.pipeline("text-classification", model=HF_MODEL, top_k=3)` once during app startup
- Normalizes model labels to the supported intent set
- Returns:

```json
{
  "intent": "bug_report",
  "confidence": 0.95,
  "top3": [
    { "intent": "bug_report", "confidence": 0.95 },
    { "intent": "login_issue", "confidence": 0.03 },
    { "intent": "performance_issue", "confidence": 0.01 }
  ]
}
```

### `RoutingService`

- Lives in `backend/app/services/routing_service.py`
- Loads `backend/app/config/routing_config.json`
- Keeps routing policy separate from model logic

### `GmailService`

- Lives in `backend/app/services/gmail_service.py`
- Decrypts the stored Gmail refresh token only in memory
- Refreshes access tokens using Google OAuth credentials
- Parses Gmail payloads into:
  - sender
  - subject
  - plain-text body
  - received time

If Google returns `invalid_grant`, the credential status is updated to `needs_reauth`.

### `SyncService`

- Lives in `backend/app/services/sync_service.py`
- Runs inside an APScheduler interval job
- Uses a small overlap window when querying Gmail, then deduplicates by `gmail_message_id`
- For each new message:
  1. Parse the Gmail payload
  2. Store the email
  3. Classify `Subject + Body`
  4. Enrich with routing data
  5. Store the prediction

## Persistence

### Tables

`emails`
- raw Gmail message metadata and body text

`predictions`
- classifier output plus routing metadata

`credentials`
- encrypted Gmail refresh token and credential status

### Database Strategy

- SQLAlchemy ORM only
- SQLite for local development
- WAL mode enabled at startup
- Intended PostgreSQL migration path through `DATABASE_URL`

## API Design

### Auth

- `GET /auth/google/connect`
- `GET /auth/google/callback`

### Inference

- `POST /classify`

### Dashboard

- `GET /emails`
- `GET /emails/{id}`
- `GET /stats`

### Health

- `GET /health`

## Frontend

The frontend is a React dashboard composed of:

- Sidebar intent/department filters
- Search + refresh controls
- Stat cards
- Paginated email queue
- Detail drawer for the selected message

The frontend talks directly to the backend REST API through `frontend/src/services/api.ts`.

## Startup Lifecycle

FastAPI lifespan startup currently does the following:

1. Enables SQLite WAL mode when using SQLite
2. Loads the classifier model
3. Loads routing config
4. Creates the Gmail and sync services
5. Starts the background polling scheduler

On shutdown, the scheduler is stopped cleanly.

## Testing

Current automated coverage focuses on core business logic:

- `backend/tests/test_routing_service.py`
- `backend/tests/test_classifier_service.py`

These tests validate routing behavior, classifier label normalization, and key error paths without requiring live Gmail access.
