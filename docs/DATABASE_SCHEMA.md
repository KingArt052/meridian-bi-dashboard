# Database Schema (PostgreSQL — production reference)

The running demo in this repo uses SQLite (`backend/src/db/schema.sql`) so it works
with zero external setup. The schema below is the production-target design —
identical structure, Postgres types/constraints. Swapping the SQLite adapter in
`backend/src/db/index.ts` for `pg` + this DDL is the only change needed to go to
production (Supabase, RDS, Render Postgres, etc. all work).

```sql
-- Portfolio companies the holding company tracks
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    industry        TEXT NOT NULL,
    stage           TEXT NOT NULL CHECK (stage IN ('seed','growth','mature','turnaround')),
    ownership_pct   NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every ingestion run is logged for auditability (who/what/when/how much data)
CREATE TABLE raw_metric_imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    source          TEXT NOT NULL CHECK (source IN ('google_sheets','csv','api','manual')),
    idempotency_key TEXT NOT NULL UNIQUE,   -- company_id + period + source hash
    row_count       INTEGER NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success','partial','failed')),
    error_detail    TEXT,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalized metric time series — the single source of truth for all charts/AI analysis
CREATE TABLE metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    import_id       UUID REFERENCES raw_metric_imports(id),
    metric_type     TEXT NOT NULL CHECK (metric_type IN (
                        'revenue_cents','expenses_cents','profit_margin_pct',
                        'cac_cents','leads','conversion_rate_pct',
                        'sales_count','marketing_spend_cents','revenue_growth_pct'
                    )),
    period          DATE NOT NULL,          -- first day of the month the value covers
    value           NUMERIC NOT NULL,
    category        TEXT,                   -- optional sub-segment (e.g. product line, region)
    source          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, metric_type, period, category)
);
CREATE INDEX idx_metrics_company_period ON metrics (company_id, period);
CREATE INDEX idx_metrics_type ON metrics (metric_type);

-- Detected anomalies (statistical + rule-based)
CREATE TABLE anomalies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    metric_type     TEXT NOT NULL,
    period          DATE NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    method          TEXT NOT NULL,          -- 'z_score' | 'pct_change' | 'threshold'
    observed_value  NUMERIC NOT NULL,
    expected_range  NUMERIC[2],
    description     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts sent out (may be 1:1 with an anomaly, or threshold-based independent of anomaly detection)
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    anomaly_id      UUID REFERENCES anomalies(id),
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    channel         TEXT NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard','slack','email')),
    delivered       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cached AI-generated executive summaries, keyed by a hash of the input data
-- so identical periods are never re-billed to the Claude API
CREATE TABLE ai_insights (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    input_data_hash     TEXT NOT NULL,
    what_is_happening   TEXT NOT NULL,
    why_it_matters      TEXT NOT NULL,
    what_changed        TEXT NOT NULL,
    risks               TEXT NOT NULL,
    recommended_actions TEXT NOT NULL,
    model               TEXT NOT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, period_start, period_end, input_data_hash)
);
```

### Design notes
- **Money as integer cents** everywhere to avoid floating-point drift in aggregations.
- **`raw_metric_imports`** gives a full audit trail — any number on the dashboard can be traced back to which import produced it, which matters when management asks "why did this change?".
- **`idempotency_key`** on imports prevents duplicate ingestion if an n8n workflow retries or a Sheet is re-synced.
- **`ai_insights` caching** on a data hash avoids redundant, costly Claude API calls when nothing has changed since the last generation.
