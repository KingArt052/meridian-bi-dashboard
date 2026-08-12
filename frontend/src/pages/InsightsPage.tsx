import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AiInsight, Company } from '../types';
import { FilterBar } from '../components/FilterBar';
import { ExecutiveSummaryCard } from '../components/ExecutiveSummaryCard';
import { useFilters } from '../context/FilterContext';

export function InsightsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { selectedCompanyId, setSelectedCompanyId } = useFilters();

  useEffect(() => {
    api.getCompanies().then((r) => {
      setCompanies(r.companies);
      if (!selectedCompanyId && r.companies.length > 0) setSelectedCompanyId(r.companies[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoading(true);
    api
      .getLatestInsight(selectedCompanyId)
      .then((r) => setInsight(r.insight))
      .catch(() => setInsight(null))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  async function handleGenerate(force: boolean) {
    if (!selectedCompanyId) return;
    setGenerating(true);
    try {
      const res = await api.generateInsight(selectedCompanyId, force);
      setInsight(res.insight);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <FilterBar
        title="AI Insights"
        subtitle="Claude-generated executive briefings, one per portfolio company"
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
      />
      <div style={{ padding: '24px 32px', maxWidth: 760 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : insight ? (
          <ExecutiveSummaryCard insight={insight} onRegenerate={() => handleGenerate(true)} regenerating={generating} />
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 32, textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 16 }}>
              No summary generated yet for this company.
            </div>
            <button onClick={() => handleGenerate(false)} disabled={generating} style={generateButtonStyle}>
              {generating ? 'Generating…' : 'Generate Executive Summary'}
            </button>
          </div>
        )}
      </div>
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
