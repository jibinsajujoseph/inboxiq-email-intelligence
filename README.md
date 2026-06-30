# InboxIQ

InboxIQ is an end-to-end MVP for AI-assisted customer support triage. It connects to one Gmail inbox, polls for new emails, classifies each message with a locally loaded DistilRoBERTa model, enriches the prediction with business routing rules, stores the results, and presents the queue in a React dashboard.

The runtime product is not an LLM app. In production, the intelligence layer is a small Hugging Face classifier running in-process inside the FastAPI backend. An LLM only shows up offline in the dataset-generation notebook that was used to build the training corpus.

## What It Does

- Connects a single Gmail inbox using a one-time Google OAuth flow
- Stores the Gmail refresh token encrypted at rest
- Polls Gmail every 25 seconds with APScheduler
- Classifies emails locally with `transformers.pipeline(..., top_k=3)`
- Evaluates prediction confidence against thresholds (`confidence_config.json`) to flag emails for review
- Maps intents to department, priority, and SLA from JSON config
- Persists emails, predictions, and review state in SQLAlchemy models
- Exposes dashboard APIs for list, detail, stats, review actions, filtering, and pagination
- Renders a responsive React dashboard with a dedicated review queue for human-in-the-loop triage

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

## Model Development

The classifier was trained as part of this project, and the repo keeps that workflow visible:

- `data/email_intent_dataset_generator.ipynb` generates a synthetic support-email dataset across the eight supported intents. In the current notebook configuration it uses `gpt-4o-mini` to create 50 seed emails per intent, then expands them with Python augmentation into 1,000 examples per intent.
- The generator exports `train.jsonl`, `val.jsonl`, `test.jsonl`, and `label_metadata.json` with a stratified 80/10/10 split.
- `training/train_distilroberta_email_intent.ipynb` pulls the dataset from `jibinsajujoseph/email-intent-dataset`, fine-tunes `distilroberta-base`, compares it against a TF-IDF + logistic regression baseline, runs confidence and confusion analysis, and supports optional unseen holdout evaluation.
- The backend serves the resulting classifier from `HF_MODEL`, which currently points to `jibinsajujoseph/email-intent-classifier`.

Those notebooks are part of the project story, even though they are not required to run the app locally.

## Project Structure

```text
data/
  email_intent_dataset_generator.ipynb
training/
  train_distilroberta_email_intent.ipynb
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

InboxIQ reads configuration from the root `.env` file. Start by copying `.env.example` to `.env` and filling in your real values.

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
- `PATCH /emails/{id}/review`
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
- The synthetic-data generator and training notebooks are offline build assets; the running app only needs the published model referenced by `HF_MODEL`.
- The frontend TypeScript build is valid, but Vite 8 requires Node `20.19+` or `22.12+` for full production builds.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
