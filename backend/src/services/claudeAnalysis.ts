import { randomUUID, createHash } from 'crypto';
import fetch from 'node-fetch';
import { db } from '../db';
import { AiInsight, Anomaly, Company, Metric, MetricType } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

interface PeriodSnapshot {
  metric_type: MetricType;
  latest: number;
  prior: number | null;
  pct_change: number | null;
  six_month_avg: number | null;
}

/**
 * Pre-computes deltas and growth rates in code (deterministic, auditable)
 * rather than asking the LLM to do arithmetic on raw numbers. Claude's job
 * is to EXPLAIN the pre-computed picture, not calculate it — this keeps
 * the numbers on the dashboard trustworthy regardless of model behavior.
 */
function buildSnapshot(companyId: string): { snapshot: PeriodSnapshot[]; anomalies: Anomaly[]; company: Company; latestPeriod: string } {
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId) as Company;
  const metricTypes = db
    .prepare(`SELECT DISTINCT metric_type FROM metrics WHERE company_id = ?`)
    .all(companyId) as { metric_type: MetricType }[];

  const snapshot: PeriodSnapshot[] = [];
  let latestPeriod = '';

  for (const { metric_type } of metricTypes) {
    const history = db
      .prepare(`SELECT * FROM metrics WHERE company_id = ? AND metric_type = ? ORDER BY period ASC`)
      .all(companyId, metric_type) as Metric[];
    if (history.length === 0) continue;

    const latest = history[history.length - 1];
    latestPeriod = latest.period;
    const prior = history.length > 1 ? history[history.length - 2].value : null;
    const pctChange = prior !== null && prior !== 0 ? (latest.value - prior) / Math.abs(prior) : null;
    const window = history.slice(-7, -1);
    const sixMonthAvg = window.length > 0 ? window.reduce((s, m) => s + m.value, 0) / window.length : null;

    snapshot.push({
      metric_type,
      latest: Math.round(latest.value * 100) / 100,
      prior: prior !== null ? Math.round(prior * 100) / 100 : null,
      pct_change: pctChange !== null ? Math.round(pctChange * 10000) / 10000 : null,
      six_month_avg: sixMonthAvg !== null ? Math.round(sixMonthAvg * 100) / 100 : null,
    });
  }

  const anomalies = db
    .prepare(`SELECT * FROM anomalies WHERE company_id = ? AND status = 'open' ORDER BY severity DESC`)
    .all(companyId) as Anomaly[];

  return { snapshot, anomalies, company, latestPeriod };
}

function hashInput(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const SYSTEM_PROMPT = `You are a senior financial analyst producing a monthly executive briefing for the
management team of a holding company that owns stakes in several operating businesses.

You will be given pre-computed metrics (latest value, prior value, % change, 6-month average)
and any statistically detected anomalies for one portfolio company. Do NOT recompute or
second-guess the numbers — treat them as ground truth and explain what they mean.

Respond with ONLY a JSON object (no markdown fences, no preamble) matching exactly this shape:
{
  "what_is_happening": "2-3 sentences, plain language, current state of the business",
  "why_it_matters": "2-3 sentences on the business implications",
  "what_changed": "2-3 sentences on the most significant deltas vs prior period/trend",
  "risks": "2-3 sentences on potential risks, phrased concretely, not generic",
  "recommended_actions": "2-4 concrete, specific, prioritized action items as a single string with '; ' separators"
}
Be specific and reference actual numbers/percentages from the data provided. Avoid vague filler
like "continue monitoring performance." If no anomalies are present, say performance is stable
rather than inventing risk.`;

export async function generateExecutiveSummary(companyId: string, forceRegenerate = false): Promise<AiInsight> {
  const { snapshot, anomalies, company, latestPeriod } = buildSnapshot(companyId);

  const inputPayload = { company: company.name, industry: company.industry, stage: company.stage, snapshot, anomalies };
  const dataHash = hashInput(inputPayload);

  if (!forceRegenerate) {
    const cached = db
      .prepare(
        `SELECT * FROM ai_insights WHERE company_id = ? AND input_data_hash = ? ORDER BY generated_at DESC LIMIT 1`
      )
      .get(companyId, dataHash) as AiInsight | undefined;
    if (cached) return cached;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let parsed: {
    what_is_happening: string;
    why_it_matters: string;
    what_changed: string;
    risks: string;
    recommended_actions: string;
  };

  if (!apiKey) {
    // Graceful degradation: dashboard stays functional without a key configured,
    // clearly labeled as a fallback rather than pretending to be AI output.
    parsed = fallbackSummary(company, snapshot, anomalies);
  } else {
    const userContent = `Portfolio company data:\n${JSON.stringify(inputPayload, null, 2)}`;
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      parsed = fallbackSummary(company, snapshot, anomalies);
    } else {
      const data = (await response.json()) as any;
      const text = (data.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      try {
        const cleaned = text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse Claude response as JSON:', text);
        parsed = fallbackSummary(company, snapshot, anomalies);
      }
    }
  }

  const insight: AiInsight = {
    id: randomUUID(),
    company_id: companyId,
    period_start: latestPeriod,
    period_end: latestPeriod,
    input_data_hash: dataHash,
    what_is_happening: parsed.what_is_happening,
    why_it_matters: parsed.why_it_matters,
    what_changed: parsed.what_changed,
    risks: parsed.risks,
    recommended_actions: parsed.recommended_actions,
    model: apiKey ? CLAUDE_MODEL : 'fallback-rule-based',
    generated_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT OR REPLACE INTO ai_insights
     (id, company_id, period_start, period_end, input_data_hash, what_is_happening, why_it_matters, what_changed, risks, recommended_actions, model, generated_at)
     VALUES (@id, @company_id, @period_start, @period_end, @input_data_hash, @what_is_happening, @why_it_matters, @what_changed, @risks, @recommended_actions, @model, @generated_at)`
  ).run(insight as any);

  return insight;
}

/**
 * Deterministic, rule-based fallback used when no ANTHROPIC_API_KEY is
 * configured or the API call fails — keeps the dashboard demoable and the
 * failure mode transparent (labeled model = 'fallback-rule-based').
 */
function fallbackSummary(
  company: Company,
  snapshot: PeriodSnapshot[],
  anomalies: Anomaly[]
): { what_is_happening: string; why_it_matters: string; what_changed: string; risks: string; recommended_actions: string } {
  const revenue = snapshot.find((s) => s.metric_type === 'revenue_cents');
  const margin = snapshot.find((s) => s.metric_type === 'profit_margin_pct');
  const revChangePct = revenue?.pct_change ? (revenue.pct_change * 100).toFixed(1) : 'n/a';

  return {
    what_is_happening: `${company.name} reported revenue of $${((revenue?.latest || 0) / 100).toLocaleString()} this period with a profit margin of ${(margin?.latest ?? 0).toFixed(1)}%.`,
    why_it_matters: `As a ${company.stage}-stage business in ${company.industry}, revenue trend directly affects portfolio-level return expectations.`,
    what_changed: `Revenue moved ${revChangePct}% versus the prior month.`,
    risks: anomalies.length > 0
      ? anomalies.map((a) => a.description).join('; ')
      : 'No statistically significant anomalies detected this period.',
    recommended_actions: anomalies.length > 0
      ? 'Review flagged metrics with the operating team; confirm root cause; reassess forecast if trend persists.'
      : 'Maintain current operating cadence; no immediate action required.',
  };
}
