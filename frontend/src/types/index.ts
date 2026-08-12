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

export interface Company {
  id: string;
  name: string;
  industry: string;
  stage: 'seed' | 'growth' | 'mature' | 'turnaround';
  ownership_pct: number;
  is_active: number;
  latest: Partial<Record<MetricType, number>>;
  open_alerts: number;
}

export interface Metric {
  id: string;
  company_id: string;
  metric_type: MetricType;
  period: string;
  value: number;
  category: string;
  source: string;
}

export interface Anomaly {
  id: string;
  company_id: string;
  metric_type: MetricType;
  period: string;
  severity: Severity;
  method: string;
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
  company_name: string;
  anomaly_id: string | null;
  severity: Severity;
  title: string;
  message: string;
  channel: string;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface AiInsight {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  what_is_happening: string;
  why_it_matters: string;
  what_changed: string;
  risks: string;
  recommended_actions: string;
  model: string;
  generated_at: string;
}

export const METRIC_LABELS: Record<MetricType, string> = {
  revenue_cents: 'Revenue',
  expenses_cents: 'Expenses',
  profit_margin_pct: 'Profit Margin',
  cac_cents: 'CAC',
  leads: 'Leads',
  conversion_rate_pct: 'Conversion Rate',
  sales_count: 'Sales',
  marketing_spend_cents: 'Marketing Spend',
  revenue_growth_pct: 'Revenue Growth',
};
