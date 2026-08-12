import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Company } from '../types';
import { CompanyTable } from '../components/CompanyTable';

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .getCompanies()
      .then((r) => setCompanies(r.companies))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.industry.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div style={{ padding: '22px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: 0 }}>All Companies</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>{companies.length} portfolio companies</div>
        </div>
        <input
          placeholder="Search by name or industry…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            fontSize: 13,
            width: 260,
          }}
        />
      </div>
      <div style={{ padding: '24px 32px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : (
          <CompanyTable companies={filtered} />
        )}
      </div>
    </div>
  );
}
