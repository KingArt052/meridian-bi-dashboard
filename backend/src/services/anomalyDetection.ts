import { randomUUID } from 'crypto';
import { db } from '../db';
import { Metric, MetricType, Severity } from '../types';

/**
 * Anomaly detection combines two independent signals so a single noisy
 * month doesn't trigger a false alarm:
 *   1. Z-score vs the metric's own trailing history (statistical outlier)
 *   2. Month-over-month % change vs a per-metric-type threshold (business rule)
 * An anomaly is only recorded when BOTH agree the change is meaningful,
 * OR the % change alone crosses a "critical" threshold (e.g. revenue
 * dropping >25% in a month is worth flagging even if the trailing history
 * is short/volatile).
 */

const METRIC_CHANGE_THRESHOLDS: Partial<Record<MetricType, number>> = {
  revenue_cents: 0.15,
  expenses_cents: 0.2,
  profit_margin_pct: 0.25,
  cac_cents: 0.25,
  leads: 0.3,
  conversion_rate_pct: 0.25,
  marketing_spend_cents: 0.3,
};

// Metrics where a DROP is the bad direction (used for severity/description framing)
const LOWER_IS_WORSE: Set<MetricType> = new Set([
  'revenue_cents',
  'profit_margin_pct',
  'leads',
  'conversion_rate_pct',
  'sales_count',
  'revenue_growth_pct',
]);

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function severityFor(pctChange: number, zScore: number): Severity {
  const magnitude = Math.max(Math.abs(pctChange), Math.abs(zScore) / 3);
  if (magnitude >= 0.5) return 'critical';
  if (magnitude >= 0.3) return 'high';
  if (magnitude >= 0.18) return 'medium';
  return 'low';
}

export interface DetectionResult {
  anomaliesCreated: number;
}

/**
 * Runs detection for a single company across all metric types, using the
 * most recent period vs its trailing 6-month window. Idempotent-ish: it
 * clears open anomalies for periods it re-evaluates before inserting fresh
 * ones, so re-running doesn't pile up duplicates.
 */
export function detectAnomaliesForCompany(companyId: string): DetectionResult {
  const metricTypes = db
    .prepare(`SELECT DISTINCT metric_type FROM metrics WHERE company_id = ?`)
    .all(companyId) as { metric_type: MetricType }[];

  let created = 0;
  const insertAnomaly = db.prepare(
    `INSERT INTO anomalies (id, company_id, metric_type, period, severity, method, observed_value, expected_low, expected_high, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`
  );
  const updateAnomaly = db.prepare(
    `UPDATE anomalies SET severity = ?, method = ?, observed_value = ?, expected_low = ?, expected_high = ?, description = ?, detected_at = datetime('now')
     WHERE id = ?`
  );
  const findExisting = db.prepare(
    `SELECT id FROM anomalies WHERE company_id = ? AND metric_type = ? AND period = ?`
  );

  for (const { metric_type } of metricTypes) {
    const history = db
      .prepare(
        `SELECT * FROM metrics WHERE company_id = ? AND metric_type = ? ORDER BY period ASC`
      )
      .all(companyId, metric_type) as Metric[];

    if (history.length < 4) continue; // not enough history to judge

    const latest = history[history.length - 1];
    const prior = history.slice(0, -1);
    const trailingWindow = prior.slice(-6); // trailing up-to-6 months excluding latest

    const avg = mean(trailingWindow.map((m) => m.value));
    const sd = stdDev(trailingWindow.map((m) => m.value), avg);
    const zScore = sd === 0 ? 0 : (latest.value - avg) / sd;

    const prevValue = prior[prior.length - 1].value;
    const pctChange = prevValue === 0 ? 0 : (latest.value - prevValue) / Math.abs(prevValue);

    const threshold = METRIC_CHANGE_THRESHOLDS[metric_type] ?? 0.25;
    const zTrigger = Math.abs(zScore) >= 2;
    const pctTrigger = Math.abs(pctChange) >= threshold;
    const criticalPctTrigger = Math.abs(pctChange) >= threshold * 1.6;

    if ((zTrigger && pctTrigger) || criticalPctTrigger) {
      // Upsert by (company_id, metric_type, period) rather than delete+insert:
      // once an anomaly has an alert referencing it via foreign key, deleting
      // the anomaly row would violate that constraint. Updating in place also
      // better reflects reality — it's the same anomaly being re-evaluated
      // with fresher stats, not a new one.
      const direction = pctChange < 0 ? 'dropped' : 'increased';
      const worseNote = LOWER_IS_WORSE.has(metric_type)
        ? pctChange < 0
          ? ' — unfavorable direction'
          : ' — favorable direction'
        : '';

      const description = `${metric_type.replace(/_/g, ' ')} ${direction} ${(Math.abs(pctChange) * 100).toFixed(1)}% vs prior month (z=${zScore.toFixed(2)})${worseNote}`;
      const severity = severityFor(pctChange, zScore);
      const method = zTrigger && pctTrigger ? 'z_score' : 'pct_change';
      const expectedLow = avg - 2 * sd;
      const expectedHigh = avg + 2 * sd;

      const existing = findExisting.get(companyId, metric_type, latest.period) as { id: string } | undefined;
      if (existing) {
        updateAnomaly.run(severity, method, latest.value, expectedLow, expectedHigh, description, existing.id);
      } else {
        insertAnomaly.run(randomUUID(), companyId, metric_type, latest.period, severity, method, latest.value, expectedLow, expectedHigh, description);
        created++;
      }
    }
  }

  return { anomaliesCreated: created };
}

export function detectAnomaliesForAllCompanies(): DetectionResult {
  const companies = db.prepare(`SELECT id FROM companies WHERE is_active = 1`).all() as { id: string }[];
  let total = 0;
  for (const c of companies) {
    total += detectAnomaliesForCompany(c.id).anomaliesCreated;
  }
  return { anomaliesCreated: total };
}
