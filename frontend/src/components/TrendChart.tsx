import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Metric, MetricType, METRIC_LABELS } from '../types';
import { formatMetricValue, formatPeriod } from '../utils/format';

export function TrendChart({ metricType, history, color = 'var(--accent-brand)' }: { metricType: MetricType; history: Metric[]; color?: string }) {
  const data = history.map((m) => ({ period: m.period, value: m.value }));

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>{METRIC_LABELS[metricType]}</div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={(p) => formatPeriod(p)}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tickFormatter={(v) => formatMetricValue(metricType, v)}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(p) => formatPeriod(String(p))}
              formatter={(v: number) => [formatMetricValue(metricType, v), METRIC_LABELS[metricType]]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
