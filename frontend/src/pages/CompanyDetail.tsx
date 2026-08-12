import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AiInsight, Anomaly, Company, Metric, MetricType } from '../types';
import { TrendChart } from '../components/TrendChart';
import { KpiCard } from '../components/KpiCard';
import { ExecutiveSummaryCard } from '../components/ExecutiveSummaryCard';
import { formatPeriod, severityColor } from '../utils/format';

const CHART_METRICS: { type: MetricType; favorableUp: boolean; color: string }[] = [
  { type: 'revenue_cents', favorableUp: true, color: 'var(--accent-positive)' },
  { type: 'expenses_cents', favorableUp: false, color: 'var(--accent-warning)' },
  { type: 'profit_margin_pct', favorableUp: true, color: 'var(--accent-brand)' },
  { type: 'leads', favorableUp: true, color: 'var(--accent-brand)' },
  { type: 'conversion_rate_pct', favorableUp: true, color: 'var(--accent-positive)' },
  { type: 'cac_cents', favorableUp: false, color: 'var(--accent-warning)' },
];

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [metricsByType, setMetricsByType] = useState<Record<string, Metric[]>>({});
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [companyRes, anomaliesRes] = await Promise.all([api.getCompany(id), api.getAnomalies({ company: id })]);
      setCompany(companyRes.company);
      setAnomalies(anomaliesRes.anomalies);

      const entries = await Promise.all(
        CHART_METRICS.map(async (m) => {
          const r = await api.getMetrics({ company: id, type: m.type });
          return [m.type, r.metrics] as const;
        })
      );
      setMetricsByType(Object.fromEntries(entries));

      try {
        const insightRes = await api.getLatestInsight(id);
        setInsight(insightRes.insight);
      } catch {
        setInsight(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleGenerate(force: boolean) {
    if (!id) return;
    setGenerating(true);
    try {
      const res = await api.generateInsight(id, force);
      setInsight(res.insight);
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !company) {
    return <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-muted)' }}>Loading company detail…</div>;
  }

  return (
    <div>
      <div style={{ padding: '22px 32px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, padding: 0, marginBottom: 10 }}>
          ← Back
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: 0 }}>{company.name}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              {company.industry} · <span style={{ textTransform: 'capitalize' }}>{company.stage}</span>-stage ·{' '}
              {company.ownership_pct.toFixed(0)}% owned
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {CHART_METRICS.slice(0, 4).map((m) => (
            <KpiCard key={m.type} metricType={m.type} history={metricsByType[m.type] || []} favorableIsUp={m.favorableUp} />
          ))}
        </div>

        {anomalies.length > 0 && (
          <div>
            <SectionLabel>Detected Anomalies</SectionLabel>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 18px' }}>
              {anomalies.map((a, i) => (
                <div key={a.id} style={{ padding: '12px 0', borderBottom: i < anomalies.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: severityColor(a.severity), marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13 }}>
                      {a.description} <span style={{ color: 'var(--text-muted)' }} className="num">· {formatPeriod(a.period)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>AI Executive Summary</SectionLabel>
          {insight ? (
            <ExecutiveSummaryCard insight={insight} onRegenerate={() => handleGenerate(true)} regenerating={generating} />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 28, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 14 }}>No summary generated for this company yet.</div>
              <button onClick={() => handleGenerate(false)} disabled={generating} style={generateButtonStyle}>
                {generating ? 'Generating…' : 'Generate Executive Summary'}
              </button>
            </div>
          )}
        </div>

        <div>
          <SectionLabel>Trends</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {CHART_METRICS.map((m) => (
              <TrendChart key={m.type} metricType={m.type} history={metricsByType[m.type] || []} color={m.color} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

const generateButtonStyle: React.CSSProperties = {
  background: 'var(--accent-brand-dim)',
  color: 'var(--accent-brand)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 500,
};
