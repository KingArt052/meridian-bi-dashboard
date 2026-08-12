-- SQLite runtime schema (demo/dev). Structurally mirrors docs/DATABASE_SCHEMA.md (Postgres).
-- See docs/DATABASE_SCHEMA.md for the production DDL and design rationale.

CREATE TABLE IF NOT EXISTS companies (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    industry        TEXT NOT NULL,
    stage           TEXT NOT NULL CHECK (stage IN ('seed','growth','mature','turnaround')),
    ownership_pct   REAL NOT NULL DEFAULT 100.0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raw_metric_imports (
    id              TEXT PRIMARY KEY,
    company_id      TEXT NOT NULL REFERENCES companies(id),
    source          TEXT NOT NULL CHECK (source IN ('google_sheets','csv','api','manual')),
    idempotency_key TEXT NOT NULL UNIQUE,
    row_count       INTEGER NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success','partial','failed')),
    error_detail    TEXT,
    imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics (
    id              TEXT PRIMARY KEY,
    company_id      TEXT NOT NULL REFERENCES companies(id),
    import_id       TEXT REFERENCES raw_metric_imports(id),
    metric_type     TEXT NOT NULL CHECK (metric_type IN (
                        'revenue_cents','expenses_cents','profit_margin_pct',
                        'cac_cents','leads','conversion_rate_pct',
                        'sales_count','marketing_spend_cents','revenue_growth_pct'
                    )),
    period          TEXT NOT NULL,
    value           REAL NOT NULL,
    category        TEXT DEFAULT '',
    source          TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, metric_type, period, category)
);
CREATE INDEX IF NOT EXISTS idx_metrics_company_period ON metrics (company_id, period);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics (metric_type);

CREATE TABLE IF NOT EXISTS anomalies (
    id              TEXT PRIMARY KEY,
    company_id      TEXT NOT NULL REFERENCES companies(id),
    metric_type     TEXT NOT NULL,
    period          TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    method          TEXT NOT NULL,
    observed_value  REAL NOT NULL,
    expected_low    REAL,
    expected_high   REAL,
    description     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    detected_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id              TEXT PRIMARY KEY,
    company_id      TEXT NOT NULL REFERENCES companies(id),
    anomaly_id      TEXT REFERENCES anomalies(id),
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    channel         TEXT NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard','slack','email')),
    delivered       INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_insights (
    id                  TEXT PRIMARY KEY,
    company_id          TEXT NOT NULL REFERENCES companies(id),
    period_start        TEXT NOT NULL,
    period_end          TEXT NOT NULL,
    input_data_hash     TEXT NOT NULL,
    what_is_happening   TEXT NOT NULL,
    why_it_matters      TEXT NOT NULL,
    what_changed        TEXT NOT NULL,
    risks               TEXT NOT NULL,
    recommended_actions TEXT NOT NULL,
    model               TEXT NOT NULL,
    generated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, period_start, period_end, input_data_hash)
);
