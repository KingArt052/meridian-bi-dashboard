import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Metric, MetricType, METRIC_LABELS } from '../types';
import { formatMetricValue } from '../utils/format';

interface Props {
  metricType: MetricType;
  history: Metric[]; // chronological, ascending period
  favorableIsUp?: boolean;
}

export function KpiCard({ metricType, history, favorableIsUp = true }: Props) {
  const latest = history[history.length - 1];
  const prior = history[history.length - 2];
  const pctChange = latest && prior && prior.value !== 0 ? ((latest.value - prior.value) / Math.abs(prior.value)) * 100 : null;

  const isGood = pctChange === null ? null : favorableIsUp ? pctChange >= 0 : pctChange < 0;
  const deltaColor = isGood === null ? 'var(--text-muted)' : isGood ? 'var(--accent-positive)' : 'var(--accent-negative)';
  const deltaBg = isGood === null ? 'transparent' : isGood ? 'var(--accent-positive-dim)' : 'var(--accent-negative-dim)';

  const sparkData = history.slice(-9).map((m) => ({ v: m.value }));

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{METRIC_LABELS[metricType]}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="num" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>
            {latest ? formatMetricValue(metricType, latest.value) : '—'}
          </div>
          {pctChange !== null && (
            <div
              className="num"
              style={{
                display: 'inline-block',
                marginTop: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: deltaColor,
                background: deltaBg,
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}%
            </div>
          )}
        </div>
        {sparkData.length > 1 && (
          <div style={{ width: 72, height: 32 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke={deltaColor === 'var(--text-muted)' ? 'var(--text-muted)' : deltaColor} strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
