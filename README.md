# InboxIQ

InboxIQ is a production-style MVP for AI-assisted customer support triage. It connects to one Gmail inbox, polls for new emails, classifies each message with a locally loaded DistilRoBERTa model, enriches the prediction with business routing rules, stores the results, and presents the queue in a React dashboard.

This is not an LLM app. The intelligence layer is a small, already-trained Hugging Face classifier running in-process inside the FastAPI backend.

## What It Does

- Connects a single Gmail inbox using a one-time Google OAuth flow
- Stores the Gmail refresh token encrypted at rest
- Polls Gmail every 25 seconds with APScheduler
- Classifies emails locally with `transformers.pipeline(..., top_k=3)`
- Maps intents to department, priority, and SLA from JSON config
- Persists emails, predictions, and credentials in SQLAlchemy models
- Exposes dashboard APIs for list, detail, stats, filtering, and pagination
- Renders a responsive React dashboard for triage review

## Supported Intents

- `login_issue`
- `billing_refund`
- `subscription_change`
- `bug_report`
- `feature_request`
- `integration_api`
- `performance_issue`
- `security_concern`

## Stack

- Backend: FastAPI, SQLAlchemy, Alembic, APScheduler, Google API Client, Transformers, PyTorch
- Frontend: React 19, TypeScript, Vite
- Local database: SQLite
- Migration target: PostgreSQL by changing `DATABASE_URL`

## Project Structure

```text
backend/
  app/
    api/
    config/
    db/
    models/
    services/
    main.py
  tests/
frontend/
  src/
    components/
    pages/
    services/
docs/
  ARCHITECTURE.md
```

## Environment

InboxIQ reads configuration from the root `.env` file.

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
HF_MODEL=jibinsajujoseph/email-intent-classifier
DATABASE_URL=sqlite:///./inboxiq.db
SECRET_KEY=...
ENVIRONMENT=development
```

The local redirect URI is configured in code as `http://localhost:8000/auth/google/callback`.

## Running Locally

Use Node `24.18.0` for the frontend in this repo. If you use `nvm`, run `nvm use` from the project root first.

### Backend

1. Create or activate a Python environment.
2. Install backend dependencies from `backend/requirements.txt`.
3. Run Alembic migrations from `backend/`.
4. Start the API server.

Example:

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

1. Install dependencies in `frontend/`.
2. Start the Vite dev server.

Example:

```bash
cd frontend
npm install
npm run dev
```

Optional frontend env:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## API Surface

- `GET /health`
- `GET /auth/google/connect`
- `GET /auth/google/callback`
- `POST /classify`
- `GET /emails`
- `GET /emails/{id}`
- `GET /stats`

## Tests

The backend includes unit tests for:

- `RoutingService`
- `ClassifierService`

Run them from `backend/`:

```bash
python -m unittest discover -s tests -v
```

## Notes

- SQLite WAL mode is enabled at backend startup to reduce local write contention.
- If the Gmail refresh token becomes invalid, the credential is marked `needs_reauth` and the sync job is removed instead of crashing the app.
- The frontend TypeScript build is valid, but Vite 8 requires Node `20.19+` or `22.12+` for full production builds.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
