# Architecture

## System Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Data Sources    │────▶│   Ingestion Layer     │────▶│   Database       │
│  - Google Sheets │     │   (n8n scheduled jobs │     │   (SQLite dev /  │
│  - CSV files     │     │   → backend /ingest)  │     │   Postgres prod) │
│  - Manual/API     │     │   validate, normalize │     │                  │
└─────────────────┘     └──────────────────────┘     └────────┬─────────┘
                                                                 │
┌─────────────────┐     ┌──────────────────────┐     ┌────────▼─────────┐
│  React + TS      │◀────│   REST API            │◀────│  Analysis Engine │
│  Dashboard        │     │   (Node/Express)      │     │  - anomaly detect│
│  - filters/charts │     │                        │     │  - Claude API    │
│  - AI summary      │     │                        │     │    (exec summary)│
│  - alerts panel    │     └──────────────────────┘     └────────┬─────────┘
└─────────────────┘                                             │
                                                        ┌────────▼─────────┐
                                                        │  Alert Engine     │
                                                        │  → n8n webhook →  │
                                                        │    Slack/email    │
                                                        └───────────────────┘
```

## Why this shape

**Ingestion, storage, analysis, and presentation are decoupled** so any layer
can fail, be tested, or be swapped independently:
- Swapping Google Sheets for a real ERP/accounting API later touches only the
  n8n workflow and the ingestion payload shape — the database, analysis, and
  dashboard don't change.
- Swapping SQLite for Postgres touches only `backend/src/db/index.ts`.
- n8n owns *scheduling and orchestration only*. All validation, normalization,
  anomaly-detection math, and alert rules live in versioned TypeScript
  (`backend/src/services/`) — never as ad-hoc logic inside a visual workflow
  node. This is the single most important design decision for
  maintainability: a threshold change is a one-line code diff with a git
  history, not a change buried in a workflow JSON export.

## Data flow, end to end

1. n8n's scheduled trigger reads a company's Google Sheet.
2. Rows are lightly reshaped (column mapping only — no business validation)
   and POSTed to `/api/ingest`.
3. The backend's `dataIngestion` service validates the payload against a
   strict schema (zod), checks the batch's idempotency key (content hash) to
   skip exact duplicates, and writes rows inside a transaction — an import
   audit row is always written first (parent), then metric rows (children),
   respecting the foreign-key relationship.
4. On successful ingest, the backend immediately runs `anomalyDetection` for
   that company (z-score + % change combined signal), then `alertEngine`
   converts any newly-open anomalies into alert records and best-effort
   pushes them to a Slack webhook via n8n.
5. The dashboard's REST calls (`/api/companies`, `/api/metrics`, `/api/anomalies`,
   `/api/alerts`) render this data with client-side filtering by company.
6. On demand (or via a separate scheduled n8n job), `/api/insights/generate`
   pre-computes deltas/growth rates in code, sends that structured JSON to the
   Claude API with a system prompt constraining the response to a strict JSON
   shape, and caches the result keyed by a hash of the input data — so
   identical periods are never re-billed.

## Key design decisions and their rationale

| Decision | Rationale |
|---|---|
| Money stored as integer cents | Avoids floating-point drift in aggregations — non-negotiable for anything finance-adjacent |
| Every metric traces to an import batch | Any number on the dashboard can be traced back to "why did this change" — an audit trail is table stakes for a tool management will actually trust |
| Idempotent ingestion (content-hash keyed) | n8n retries after a transient network failure don't double-count metrics |
| Anomaly detection combines z-score AND % change | A single noisy month shouldn't trigger a false alarm; both signals agreeing (or one crossing a "critical" threshold) is the bar |
| Anomalies are upserted, not deleted+reinserted, on re-run | Once an alert references an anomaly via foreign key, deleting the anomaly row would violate that constraint — and semantically, re-detecting the same anomaly on the same period *is* the same anomaly, not a new one |
| Claude does not do arithmetic | The backend pre-computes every number Claude discusses; Claude's job is narrative explanation, not calculation — this keeps the numbers on the dashboard trustworthy regardless of model behavior |
| AI insights cached by data hash | Avoids redundant, costly API calls when nothing has changed since the last generation |
| Graceful fallback with no API key | The dashboard stays fully functional and demoable without `ANTHROPIC_API_KEY` configured — clearly labeled `model: "fallback-rule-based"` so it's never mistaken for real AI output |

## Failure points and handling

| Risk | Mitigation |
|---|---|
| Google Sheets malformed/missing data | Schema validation at ingestion; reject the batch with row-level error detail, never silently partial-write |
| Duplicate ingestion (n8n retry) | Idempotency key per batch (company + source + content hash) |
| Claude API timeout/rate limit/malformed response | Try/catch around the fetch and the JSON parse; falls back to rule-based summary rather than failing the request |
| Anomaly false positives | Configurable per-metric-type thresholds combined with a statistical (z-score) check, not a single signal |
| Alert webhook unreachable | Alert is still recorded in the database (channel falls back to `'dashboard'`); webhook delivery is best-effort, not the source of truth |
| Database down | `/api/health` endpoint for liveness checks; every route uses `asyncHandler` so a DB error becomes a clean 500 JSON response, not an unhandled crash |
| Secrets exposure | `ANTHROPIC_API_KEY` and `INGEST_API_KEY` only ever read from backend env vars — never sent to the frontend bundle or embedded in the n8n workflow JSON |

## What would change for a larger-scale production deployment

- Swap SQLite for Postgres (see `docs/DATABASE_SCHEMA.md` — the DDL is already written and structurally identical).
- Add authenticated user sessions to the dashboard (currently open — appropriate for an internal tool behind a VPN/SSO proxy, not for public exposure).
- Add rate limiting in front of `/api/insights/generate` since each call can cost real money against the Claude API.
- Code-split the frontend bundle (Vite currently warns about a >500KB chunk — recharts is the main contributor; dynamic `import()` per page would fix this).
