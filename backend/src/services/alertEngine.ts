import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { db } from '../db';
import { Anomaly, Company } from '../types';

/**
 * Converts open, un-alerted anomalies into Alert records, and (if
 * ALERT_WEBHOOK_URL is configured) pushes them to an n8n webhook that fans
 * out to Slack/email. This function is intentionally side-effect-safe: if
 * the webhook call fails, alerts are still recorded in the DB (channel =
 * 'dashboard') so nothing is silently lost — the webhook push is a
 * best-effort enhancement, not the source of truth.
 */
export async function generateAlertsFromOpenAnomalies(): Promise<{ created: number; delivered: number }> {
  const anomalies = db
    .prepare(
      `SELECT a.* FROM anomalies a
       LEFT JOIN alerts al ON al.anomaly_id = a.id
       WHERE a.status = 'open' AND al.id IS NULL`
    )
    .all() as Anomaly[];

  const insertAlert = db.prepare(
    `INSERT INTO alerts (id, company_id, anomaly_id, severity, title, message, channel, delivered, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`
  );
  const getCompany = db.prepare(`SELECT * FROM companies WHERE id = ?`);

  let created = 0;
  let delivered = 0;

  for (const anomaly of anomalies) {
    const company = getCompany.get(anomaly.company_id) as Company | undefined;
    if (!company) continue;

    const title = `[${anomaly.severity.toUpperCase()}] ${company.name}: ${anomaly.metric_type.replace(/_/g, ' ')} anomaly`;
    const message = `${anomaly.description} (period: ${anomaly.period})`;

    let delivered_flag = 0;
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: company.name,
            severity: anomaly.severity,
            title,
            message,
            metric_type: anomaly.metric_type,
            period: anomaly.period,
          }),
          timeout: 5000,
        } as any);
        delivered_flag = res.ok ? 1 : 0;
      } catch (err) {
        // Best-effort: log and continue. The alert is still recorded below.
        console.error('Alert webhook delivery failed:', (err as Error).message);
      }
    }

    insertAlert.run(
      randomUUID(),
      anomaly.company_id,
      anomaly.id,
      anomaly.severity,
      title,
      message,
      webhookUrl ? 'slack' : 'dashboard',
      delivered_flag
    );
    created++;
    if (delivered_flag) delivered++;
  }

  return { created, delivered };
}
