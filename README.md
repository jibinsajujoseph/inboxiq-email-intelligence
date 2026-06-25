# InboxIQ

> AI-powered email intent classification and routing for customer support.

InboxIQ is an end-to-end NLP application that automatically classifies incoming customer support emails into business intents using a fine-tuned DistilRoBERTa model.

The project includes dataset generation, transformer fine-tuning, model evaluation, and a production-ready inference pipeline. The long-term goal is to provide an intelligent email triage system that integrates with Gmail and automatically routes emails to the appropriate support team.

---

## Features

- Fine-tuned DistilRoBERTa email intent classifier
- Synthetic customer support email dataset generation
- Hugging Face Datasets integration
- Hugging Face Model Hub integration
- End-to-end training pipeline
- Model evaluation and benchmarking
- FastAPI inference API _(coming soon)_
- Gmail integration _(coming soon)_
- Interactive dashboard _(coming soon)_

---

## Supported Intents

- Login Issue
- Billing & Refund
- Subscription Change
- Bug Report
- Feature Request
- Integration / API
- Performance Issue
- Security Concern

---

## Tech Stack

- Python
- PyTorch
- Hugging Face Transformers
- Hugging Face Datasets
- Scikit-learn
- FastAPI _(planned)_
- React / Next.js _(planned)_
- Google Colab

---

## Project Structure

```
InboxIQ/
│
├── backend/          # FastAPI application
├── frontend/         # Web dashboard
├── training/         # Model training notebooks
├── data/             # Dataset generation notebooks
├── docs/             # Documentation & screenshots
│
├── requirements.txt
├── README.md
└── .gitignore
```

---

## Workflow

```
Customer Emails
        │
        ▼
Dataset Generation
        │
        ▼
Fine-tune DistilRoBERTa
        │
        ▼
Publish Model
        │
        ▼
FastAPI Inference API
        │
        ▼
Gmail Integration
        │
        ▼
Email Routing Dashboard
```

---

## Roadmap

### Phase 1

- [x] Generate synthetic customer support email dataset
- [x] Fine-tune DistilRoBERTa
- [x] Evaluate classifier
- [x] Publish dataset to Hugging Face
- [x] Publish model to Hugging Face

### Phase 2

- [ ] FastAPI backend
- [ ] Gmail API integration
- [ ] Real-time email classification
- [ ] Email routing service

### Phase 3

- [ ] Dashboard
- [ ] Docker deployment
- [ ] Cloud deployment
- [ ] Authentication
- [ ] Analytics

---

## Dataset

The training dataset consists of synthetic customer support emails covering eight business intents. The dataset was generated to closely resemble real customer support emails while maintaining balanced labels and high-quality annotations.

🤗 Dataset: https://huggingface.co/datasets/jibinsajujoseph/<dataset-name>

---

## Model

The classifier is based on **DistilRoBERTa**, fine-tuned for multi-class email intent classification.

🤗 Model: https://huggingface.co/jibinsajujoseph/email-intent-classifier

---

## License

Apache License 2.0
