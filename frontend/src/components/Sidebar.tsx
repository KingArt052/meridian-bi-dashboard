import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '◆' },
  { to: '/companies', label: 'Companies', icon: '▤' },
  { to: '/alerts', label: 'Alerts', icon: '▲' },
  { to: '/insights', label: 'AI Insights', icon: '✦' },
];

export function Sidebar({ openAlertCount }: { openAlertCount: number }) {
  return (
    <aside
      style={{
        width: 232,
        minWidth: 232,
        height: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Meridian
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.02em' }}>
          PORTFOLIO INTELLIGENCE
        </div>
      </div>

      <nav style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--surface-hover)' : 'transparent',
              transition: 'background 0.12s ease',
            })}
          >
            <span style={{ fontSize: 12, opacity: 0.8, width: 14, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
            {item.to === '/alerts' && openAlertCount > 0 && (
              <span
                className="num"
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  background: 'var(--accent-negative-dim)',
                  color: 'var(--accent-negative)',
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontWeight: 600,
                }}
              >
                {openAlertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Data synced via n8n
          <br />
          Analysis by Claude
        </div>
      </div>
    </aside>
  );
}
