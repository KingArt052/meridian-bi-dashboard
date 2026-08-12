import React from 'react';
import { Company } from '../types';

interface Props {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string | null) => void;
  rightSlot?: React.ReactNode;
  title: string;
  subtitle?: string;
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
};

export function FilterBar({ companies, selectedCompanyId, onSelectCompany, rightSlot, title, subtitle }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px 32px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {subtitle && <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <select
          style={selectStyle}
          value={selectedCompanyId || 'all'}
          onChange={(e) => onSelectCompany(e.target.value === 'all' ? null : e.target.value)}
        >
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {rightSlot}
      </div>
    </div>
  );
}
