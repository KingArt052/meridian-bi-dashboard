# Meridian — AI-Powered Portfolio Intelligence Dashboard
> **Portfolio Project — Full-Stack AI, Automation & Business Intelligence**

Meridian is a full-stack portfolio intelligence platform designed to help business leaders monitor company performance, detect anomalies, manage operational alerts, and turn financial and operational data into decision-ready insights.

An internal Business Intelligence & Automation system for a holding company
that invests in multiple businesses. It ingests operational metrics from
multiple sources, detects anomalies automatically, generates AI-written
executive briefings via the Claude API, and surfaces everything in a
filterable dashboard — with automated Slack/email alerting via n8n.

Built to demonstrate: **AI integration, workflow automation, data pipelines,
REST API design, and full-stack product engineering** for a realistic
internal-tool use case, not a toy demo.

## What it does

- **Ingests** metrics from Google Sheets (via n8n), CSV, or any API source, through one validated, idempotent ingestion path
- **Detects anomalies** automatically using combined z-score + % change signals, tuned per metric type
- **Generates AI executive summaries** (what's happening / why it matters / what changed / risks / recommended actions) via the Claude API — with numbers pre-computed in code so Claude explains rather than calculates
- **Alerts** the team automatically when something needs attention, via a Slack-integrated n8n workflow
- **Visualizes** portfolio and per-company trends across 9 metrics (revenue, expenses, margin, CAC, leads, conversion rate, sales, marketing spend, growth) with filtering by company

## Screenshots / what to look at

- `frontend/src/pages/Overview.tsx` — portfolio-wide KPI rollup + recent alerts
- `frontend/src/pages/CompanyDetail.tsx` — per-company deep dive with trend charts and the AI summary
- `backend/src/services/anomalyDetection.ts` — the detection algorithm
- `backend/src/services/claudeAnalysis.ts` — the Claude API integration and prompt design
- `automation/n8n-workflows/` — the automation layer

## Quick start

```bash
# Backend
cd backend
npm install
cp .env.example .env        # optionally add ANTHROPIC_API_KEY
npm run seed                # generates 18 months of realistic multi-company data
npm run dev                 # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
The frontend's dev server proxies `/api` to the backend automatically — no
extra config needed for local development.

**Without an `ANTHROPIC_API_KEY` configured**, AI summaries fall back to a
deterministic rule-based version, clearly labeled `model: "fallback-rule-based"`
in the response — the whole app stays functional and demoable either way.

Or run everything with Docker Compose:
```bash
docker compose up --build
```

## Project structure

```
backend/     Node/Express/TypeScript API — ingestion, anomaly detection, alerts, Claude integration
frontend/    React/TypeScript/Vite dashboard
automation/  n8n workflow definitions for scheduled ingestion + alerting
docs/        Architecture, database schema, API reference, deployment guide
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, data flow, and the reasoning behind key decisions
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — production Postgres schema and design notes
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — every endpoint, request/response shapes
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Docker Compose and split-cloud deployment guides
- [`automation/n8n-workflows/README.md`](automation/n8n-workflows/README.md) — automation design and setup

## Tech stack

React + TypeScript + Vite · Node.js/Express + TypeScript · SQLite (dev) /
PostgreSQL (production-ready schema included) · Claude API · n8n · Docker

## Design notes for reviewers

- **Data accuracy over cleverness**: money is stored as integer cents, every
  metric traces back to its import batch, and the AI never does arithmetic —
  it explains numbers the backend already computed.
- **Idempotent by default**: ingestion is keyed by a content hash so retries
  (which happen constantly in real automation pipelines) never double-count data.
- **Fails loud, not silent**: malformed ingestion batches are rejected with
  row-level errors rather than partially written; a missing API key degrades
  gracefully rather than crashing the dashboard.
- Full list of implementation decisions and their rationale in
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#key-design-decisions-and-their-rationale).
