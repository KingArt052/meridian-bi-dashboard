import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Alert, Company } from '../types';
import { FilterBar } from '../components/FilterBar';
import { AlertsPanel } from '../components/AlertsPanel';
import { useFilters } from '../context/FilterContext';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function AlertsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [severity, setSeverity] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const { selectedCompanyId, setSelectedCompanyId } = useFilters();

  async function load() {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        api.getCompanies(),
        api.getAlerts({ company: selectedCompanyId || undefined, severity: severity || undefined, status: statusFilter || undefined }),
      ]);
      setCompanies(c.companies);
      setAlerts(a.alerts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, severity, statusFilter]);

  async function handleScan() {
    setScanning(true);
    try {
      await api.detectAnomalies();
      await api.generateAlerts();
      await load();
    } finally {
      setScanning(false);
    }
  }

  async function handleUpdateStatus(id: string, status: 'acknowledged' | 'resolved') {
    await api.updateAlertStatus(id, status);
    load();
  }

  return (
    <div>
      <FilterBar
        title="Alerts"
        subtitle="Automated anomaly detection across the portfolio"
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        rightSlot={
          <button onClick={handleScan} disabled={scanning} style={scanButtonStyle}>
            {scanning ? 'Scanning…' : 'Run Analysis Now'}
          </button>
        }
      />

      <div style={{ padding: '18px 32px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} label="Open" />
        <Chip active={statusFilter === 'acknowledged'} onClick={() => setStatusFilter('acknowledged')} label="Acknowledged" />
        <Chip active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')} label="Resolved" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {SEVERITIES.map((s) => (
          <Chip key={s} active={severity === s} onClick={() => setSeverity(severity === s ? null : s)} label={s} />
        ))}
      </div>

      <div style={{ padding: '20px 32px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '4px 20px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <AlertsPanel alerts={alerts} onUpdateStatus={handleUpdateStatus} />
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent-brand-dim)' : 'var(--surface-raised)',
        color: active ? 'var(--accent-brand)' : 'var(--text-secondary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 999,
        padding: '5px 12px',
        fontSize: 12,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  );
}

const scanButtonStyle: React.CSSProperties = {
  background: 'var(--accent-brand-dim)',
  color: 'var(--accent-brand)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 500,
};
