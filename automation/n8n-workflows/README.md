# n8n Automation Workflows

## Why n8n owns *scheduling*, not *logic*

Every node in this workflow either reads from an external source (Google Sheets)
or calls the backend's REST API. **No business logic — validation, normalization
math, anomaly thresholds, alert rules — lives inside n8n.** That logic lives in
the backend (`backend/src/services/`), tested and version-controlled like normal
code. n8n's job is purely: *trigger on a schedule, move data between systems,
fan out notifications.* This split matters for maintainability — changing an
anomaly threshold means editing one TypeScript file, not hunting through a
visual workflow.

## `daily-ingestion-and-analysis.json`

Import this into n8n (Workflows → Import from File). It's a **simplified
single-company reference** — see "Scaling to multiple companies" below for how
this fans out to the full portfolio in practice.

**Flow:**
1. **Daily 6AM Trigger** — cron trigger.
2. **Read Google Sheet** — pulls that company's metrics sheet (revenue, expenses, leads, etc. — one row per metric/period).
3. **Normalize & Validate Rows** — light reshaping into the `{ metric_type, period, value, category }` shape the ingest API expects. Real validation (type checking, enum checking, range checking) happens server-side in `dataIngestion.ts` — this step just maps columns, it doesn't trust the data.
4. **POST /api/ingest** — writes to the database. The backend immediately runs anomaly detection for that company and returns `{ anomalies, alerts }` in the same response.
5. **New Alerts?** — branches on whether anomalies were found this run.
6. **Notify Slack** — only fires if there's something to say. Avoids alert fatigue from a daily "nothing happened" ping.
7. **Generate AI Executive Summary** — calls `/api/insights/generate`, runs regardless of the alert branch (management wants the weekly narrative even on quiet weeks). Cheap to call repeatedly since the backend caches by data hash.

## Scaling to multiple companies

Add a **config node** before the trigger — either a Google Sheet or a call to
`GET /api/companies` — listing each company's `company_id` and its metrics
Sheet ID. Use n8n's **Split In Batches** node to loop the Read → Normalize →
Ingest steps once per company. This keeps the workflow itself unchanged when a
new portfolio company is added — just add a row to the config sheet.

## Required environment variables (set in n8n's environment, not hardcoded in the workflow)

| Variable | Purpose |
|---|---|
| `BI_API_BASE_URL` | Deployed backend URL, e.g. `https://api.yourcompany.com` |
| `BI_INGEST_API_KEY` | Shared secret matching the backend's `INGEST_API_KEY` |
| `SLACK_ALERT_CHANNEL_ID` | Where anomaly notifications post |

## Failure handling

- If the Sheets read fails (deleted sheet, permission revoked), the workflow errors and n8n's built-in error workflow / execution history surfaces it — nothing is silently skipped.
- If `/api/ingest` returns 400 (validation failure), the row-level errors are in the response body — worth wiring an error-branch Slack notification in production so a malformed sheet doesn't fail silently until someone checks the dashboard.
- The ingest endpoint is idempotent (content-hash keyed), so a workflow retry after a transient network failure won't double-count metrics.
