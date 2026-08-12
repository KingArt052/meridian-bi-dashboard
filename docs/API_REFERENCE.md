# API Reference

Base URL: `http://localhost:4000/api` (local dev) or your deployed backend URL.
All responses are JSON. All write endpoints validate input and return
`400` with an `errors` array on failure rather than a generic 500.

---

### `GET /health`
Liveness check.
```json
{ "status": "ok", "time": "2026-08-12T21:18:24.943Z" }
```

---

### `GET /companies`
Lists active companies with their latest metric snapshot and open alert count (avoids N+1 requests for the portfolio overview page).
```json
{ "companies": [{ "id": "...", "name": "Alto Cloud Systems", "industry": "B2B SaaS", "stage": "growth", "latest": { "revenue_cents": 980000, "profit_margin_pct": 32.1, ... }, "open_alerts": 2 }] }
```

### `GET /companies/:id`
Single company record.

---

### `GET /metrics?company=&type=&from=&to=&category=`
Filtered time series. All query params optional. `from`/`to` are `YYYY-MM-DD`. Capped at 5000 rows.
```json
{ "metrics": [{ "company_id": "...", "metric_type": "revenue_cents", "period": "2026-08-01", "value": 980000, ... }], "count": 18 }
```

---

### `POST /ingest`
Server-to-server endpoint (n8n / CSV upload / any future integration). Requires header `x-ingest-key` matching `INGEST_API_KEY` (skipped with a console warning if unset — dev only).

**Body:**
```json
{
  "company_id": "uuid",
  "source": "google_sheets",
  "rows": [
    { "metric_type": "revenue_cents", "period": "2026-08-01", "value": 980000, "category": "" }
  ]
}
```
Note: `company_id` is set once at the batch level — do **not** repeat it per row.

On success, immediately runs anomaly detection and alert generation for that company and returns them in the same response:
```json
{ "status": "success", "importId": "...", "rowsWritten": 9, "errors": [], "anomalies": { "anomaliesCreated": 1 }, "alerts": { "created": 1, "delivered": 0 } }
```
Re-submitting an identical batch (same company + source + row content) is a no-op: `"errors": ["Duplicate batch — already ingested, skipped"]`.

---

### `GET /anomalies?company=&status=`
Lists detected anomalies, most recent first.

### `POST /anomalies/detect`
Manually triggers detection. Body `{ "company": "uuid" }` optional — omit to scan the whole portfolio. Returns `{ "anomaliesCreated": 3 }` (count of *new* anomalies only; re-detecting an already-open anomaly updates it in place and isn't counted again).

### `PATCH /anomalies/:id/status`
Body `{ "status": "open" | "acknowledged" | "resolved" }`.

---

### `GET /alerts?company=&severity=&status=`
Lists alerts joined with company name.

### `POST /alerts/generate`
Converts any open, un-alerted anomalies into alert records, best-effort pushing to `ALERT_WEBHOOK_URL` if configured. Returns `{ "created": 2, "delivered": 0 }` (`delivered` reflects webhook success, not just record creation).

### `PATCH /alerts/:id/status`
Body `{ "status": "open" | "acknowledged" | "resolved" }`.

---

### `POST /insights/generate`
Body `{ "company_id": "uuid", "force": false }`. Generates (or returns cached) executive summary. Set `force: true` to bypass the cache and regenerate even if the underlying data hasn't changed.
```json
{
  "insight": {
    "what_is_happening": "...",
    "why_it_matters": "...",
    "what_changed": "...",
    "risks": "...",
    "recommended_actions": "...",
    "model": "claude-sonnet-4-6",
    "generated_at": "..."
  }
}
```
If `ANTHROPIC_API_KEY` is unset or the API call fails, `model` will be `"fallback-rule-based"` — the dashboard stays functional, clearly labeled as non-AI output.

### `GET /insights/:companyId/latest`
Most recent cached summary. `404` if none generated yet.

### `GET /insights/:companyId/history`
Last 20 generated summaries for that company.

---

## Error shape
```json
{ "error": "not_found", "message": "Company not found" }
```
`error` is a stable machine-readable code; `message` is human-readable (generic in production for 500s, per `NODE_ENV`).
