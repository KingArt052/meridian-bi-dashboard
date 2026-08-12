import React from 'react';
import { Alert } from '../types';
import { formatDateTime, severityColor } from '../utils/format';

interface Props {
  alerts: Alert[];
  onUpdateStatus?: (id: string, status: 'acknowledged' | 'resolved') => void;
  compact?: boolean;
}

export function AlertsPanel({ alerts, onUpdateStatus, compact }: Props) {
  if (alerts.length === 0) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No alerts. Everything's within expected range.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {alerts.map((a, i) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: compact ? '10px 4px' : '14px 4px',
            borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: severityColor(a.severity),
              marginTop: 5,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{a.company_name}</span>
              <span
                className="num"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: severityColor(a.severity),
                  letterSpacing: '0.03em',
                }}
              >
                {a.severity}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }} className="num">
                {formatDateTime(a.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{a.message}</div>
            {onUpdateStatus && a.status === 'open' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => onUpdateStatus(a.id, 'acknowledged')}
                  style={buttonStyle}
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => onUpdateStatus(a.id, 'resolved')}
                  style={buttonStyle}
                >
                  Resolve
                </button>
              </div>
            )}
            {a.status !== 'open' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textTransform: 'capitalize' }}>{a.status}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-secondary)',
  fontSize: 11.5,
  padding: '4px 10px',
  borderRadius: 6,
};
