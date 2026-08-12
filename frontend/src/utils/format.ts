import { MetricType } from '../types';

export function formatCurrencyFromCents(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export function formatMetricValue(type: MetricType, value: number): string {
  if (type.endsWith('_cents')) return formatCurrencyFromCents(value);
  if (type.endsWith('_pct')) return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

export function formatPeriod(period: string): string {
  const d = new Date(period + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'var(--accent-negative)';
    case 'high':
      return 'var(--accent-warning)';
    case 'medium':
      return 'var(--accent-brand)';
    default:
      return 'var(--text-secondary)';
  }
}
