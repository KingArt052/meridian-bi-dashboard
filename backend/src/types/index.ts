export type MetricType =
  | 'revenue_cents'
  | 'expenses_cents'
  | 'profit_margin_pct'
  | 'cac_cents'
  | 'leads'
  | 'conversion_rate_pct'
  | 'sales_count'
  | 'marketing_spend_cents'
  | 'revenue_growth_pct';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ImportSource = 'google_sheets' | 'csv' | 'api' | 'manual';
export type CompanyStage = 'seed' | 'growth' | 'mature' | 'turnaround';

export interface Company {
  id: string;
  name: string;
  industry: string;
  stage: CompanyStage;
  ownership_pct: number;
  is_active: number;
  created_at: string;
}

export interface Metric {
  id: string;
  company_id: string;
  import_id: string | null;
  metric_type: MetricType;
  period: string; // YYYY-MM-01
  value: number;
  category: string;
  source: string;
  created_at: string;
}

export interface Anomaly {
  id: string;
  company_id: string;
  metric_type: MetricType;
  period: string;
  severity: Severity;
  method: 'z_score' | 'pct_change' | 'threshold';
  observed_value: number;
  expected_low: number | null;
  expected_high: number | null;
  description: string;
  status: 'open' | 'acknowledged' | 'resolved';
  detected_at: string;
}

export interface Alert {
  id: string;
  company_id: string;
  anomaly_id: string | null;
  severity: Severity;
  title: string;
  message: string;
  channel: 'dashboard' | 'slack' | 'email';
  delivered: number;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface AiInsight {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  input_data_hash: string;
  what_is_happening: string;
  why_it_matters: string;
  what_changed: string;
  risks: string;
  recommended_actions: string;
  model: string;
  generated_at: string;
}

export interface IngestRow {
  // company_id is NOT per-row — it's carried once at the IngestBatch level
  // and applied to every row during ingestion (see dataIngestion.ts).
  metric_type: MetricType;
  period: string; // YYYY-MM-01
  value: number;
  category?: string;
}

export interface IngestBatch {
  company_id: string;
  source: ImportSource;
  rows: IngestRow[];
}
