import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Company } from '../types';
import { formatCurrencyFromCents } from '../utils/format';

export function CompanyTable({ companies }: { companies: Company[] }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Company', 'Industry', 'Stage', 'Revenue', 'Margin', 'Growth', 'Alerts'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === 'Company' || h === 'Industry' || h === 'Stage' ? 'left' : 'right',
                  padding: '10px 16px',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const growth = c.latest.revenue_growth_pct ?? 0;
            return (
              <tr
                key={c.id}
                onClick={() => navigate(`/companies/${c.id}`)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.industry}</td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c.stage}</td>
                <td className="num" style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right' }}>
                  {c.latest.revenue_cents !== undefined ? formatCurrencyFromCents(c.latest.revenue_cents) : '—'}
                </td>
                <td className="num" style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right' }}>
                  {c.latest.profit_margin_pct !== undefined ? `${c.latest.profit_margin_pct.toFixed(1)}%` : '—'}
                </td>
                <td
                  className="num"
                  style={{
                    padding: '13px 16px',
                    fontSize: 13,
                    textAlign: 'right',
                    color: growth >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)',
                  }}
                >
                  {growth >= 0 ? '+' : ''}
                  {growth.toFixed(1)}%
                </td>
                <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                  {c.open_alerts > 0 ? (
                    <span
                      className="num"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'var(--accent-negative-dim)',
                        color: 'var(--accent-negative)',
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}
                    >
                      {c.open_alerts}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
