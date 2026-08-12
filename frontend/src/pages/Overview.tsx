import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Alert, Company } from '../types';
import { FilterBar } from '../components/FilterBar';
import { CompanyTable } from '../components/CompanyTable';
import { AlertsPanel } from '../components/AlertsPanel';
import { formatCurrencyFromCents } from '../utils/format';
import { useFilters } from '../context/FilterContext';

export function Overview() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompanyId, setSelectedCompanyId } = useFilters();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [c, a] = await Promise.all([api.getCompanies(), api.getAlerts({ status: 'open' })]);
      setCompanies(c.companies);
      setAlerts(a.alerts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredCompanies = useMemo(
    () => (selectedCompanyId ? companies.filter((c) => c.id === selectedCompanyId) : companies),
    [companies, selectedCompanyId]
  );

  const totals = useMemo(() => {
    const revenue = filteredCompanies.reduce((s, c) => s + (c.latest.revenue_cents || 0), 0);
    const expenses = filteredCompanies.reduce((s, c) => s + (c.latest.expenses_cents || 0), 0);
    const avgMargin =
      filteredCompanies.length > 0
        ? filteredCompanies.reduce((s, c) => s + (c.latest.profit_margin_pct || 0), 0) / filteredCompanies.length
        : 0;
    const openAlerts = filteredCompanies.reduce((s, c) => s + c.open_alerts, 0);
    return { revenue, expenses, avgMargin, openAlerts };
  }, [filteredCompanies]);

  if (loading) return <PageState message="Loading portfolio data…" />;
  if (error) return <PageState message={`Couldn't load data: ${error}`} isError />;

  return (
    <div>
      <FilterBar
        title="Portfolio Overview"
        subtitle={`${companies.length} companies · aggregated latest month`}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        rightSlot={
          <button onClick={load} style={refreshButtonStyle}>
            Refresh
          </button>
        }
      />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <SummaryStat label="Portfolio Revenue" value={formatCurrencyFromCents(totals.revenue)} />
          <SummaryStat label="Portfolio Expenses" value={formatCurrencyFromCents(totals.expenses)} />
          <SummaryStat label="Avg. Profit Margin" value={`${totals.avgMargin.toFixed(1)}%`} />
          <SummaryStat
            label="Open Alerts"
            value={String(totals.openAlerts)}
            accent={totals.openAlerts > 0 ? 'var(--accent-negative)' : undefined}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <SectionLabel>Companies</SectionLabel>
            <CompanyTable companies={filteredCompanies} />
          </div>
          <div>
            <SectionLabel>Recent Alerts</SectionLabel>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px 16px', maxHeight: 520, overflowY: 'auto' }}>
              <AlertsPanel alerts={alerts.filter((a) => !selectedCompanyId || a.company_id === selectedCompanyId).slice(0, 12)} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, color: accent || 'var(--text-primary)' }}>
        {value}
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

function PageState({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div style={{ padding: 64, textAlign: 'center', color: isError ? 'var(--accent-negative)' : 'var(--text-muted)', fontSize: 13.5 }}>
      {message}
    </div>
  );
}

const refreshButtonStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-secondary)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 14px',
  fontSize: 13,
};
