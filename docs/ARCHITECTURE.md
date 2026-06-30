# InboxIQ Architecture

## Overview

InboxIQ is a single-inbox support triage system. One Gmail account is connected once through OAuth, and the backend continues syncing with the stored refresh token. Each new email is classified locally, enriched with business routing metadata, written to the database, and exposed to the frontend dashboard.

The runtime path is deliberately lightweight: the backend loads a fine-tuned DistilRoBERTa classifier from Hugging Face and runs inference locally. The LLM usage in this repo lives upstream of that runtime path, inside the notebook used to generate synthetic training data.

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
   +--> RoutingService & ConfidenceService
   |      - ConfidenceService flags low confidence for human review
   |      - RoutingService maps intent -> department / priority / SLA
   |
   +--> SyncService
   |      - deduplicates by gmail_message_id
   |      - writes emails + predictions
   |
   +--> DashboardService & APIs
          - lists emails with review status filtering
          - exposes stats with review queue counts
          - handles PATCH updates for intent correction
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

## Model Development Pipeline

The model-serving path in `backend/` is backed by two notebooks that live in the repo:

### `data/email_intent_dataset_generator.ipynb`

- Generates a synthetic customer-support corpus for the eight supported intents
- Uses OpenAI to create a small seed set per intent, then expands it with deterministic Python augmentation
- Adds realistic variation such as names, companies, greetings, ticket references, forwarded-message wrappers, and occasional typos
- Exports `train.jsonl`, `val.jsonl`, `test.jsonl`, and `label_metadata.json`
- Uses a stratified 80/10/10 split; with the current notebook settings that yields 8,000 total examples across all intents

### `training/train_distilroberta_email_intent.ipynb`

- Pulls `jibinsajujoseph/email-intent-dataset` from the Hugging Face Hub
- Fine-tunes `distilroberta-base` for 8-way intent classification
- Evaluates with accuracy, macro-F1, and weighted-F1
- Compares the transformer model against a TF-IDF + logistic regression baseline
- Saves extra analysis artefacts such as confusion matrices, training curves, and per-sample prediction dumps
- Includes an optional unseen holdout evaluation to check whether the model is learning intent signals rather than only the generator's style
- Exports the model bundle and a production inference snippet that maps cleanly onto `ClassifierService`

This means the repo contains both sides of the system: the shipped inference app and the offline workflow used to create the classifier it serves.

### `ConfidenceService`

- Lives in `backend/app/services/confidence_service.py`
- Loads `backend/app/config/confidence_config.json`
- Evaluates classifier confidence against thresholds (`high_confidence_threshold`, `needs_review_threshold`) to assign a tier: `auto_routed`, `needs_review`, or `manual_review`.

### `RoutingService`

- Lives in `backend/app/services/routing_service.py`
- Loads `backend/app/config/routing_config.json`
- Keeps routing policy separate from model logic
- Re-run automatically when an intent is corrected via the review API

### `DashboardService`

- Lives in `backend/app/services/dashboard_service.py`
- Orchestrates API queries with dependency injection
- Translates `review_status` filters into threshold-based SQL queries
- Aggregates stats including the sizes of the review queues

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
