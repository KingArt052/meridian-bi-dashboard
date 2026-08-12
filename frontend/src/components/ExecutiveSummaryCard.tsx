import React from 'react';
import { AiInsight } from '../types';
import { formatDateTime } from '../utils/format';

const SECTIONS: { key: keyof AiInsight; label: string; accent: string }[] = [
  { key: 'what_is_happening', label: "What's happening", accent: 'var(--accent-brand)' },
  { key: 'why_it_matters', label: 'Why it matters', accent: 'var(--accent-brand)' },
  { key: 'what_changed', label: 'What changed', accent: 'var(--accent-warning)' },
  { key: 'risks', label: 'Risks', accent: 'var(--accent-negative)' },
  { key: 'recommended_actions', label: 'Recommended actions', accent: 'var(--accent-positive)' },
];

export function ExecutiveSummaryCard({
  insight,
  onRegenerate,
  regenerating,
}: {
  insight: AiInsight;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>Executive Summary</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }} className="num">
            Generated {formatDateTime(insight.generated_at)} · {insight.model}
            {insight.model === 'fallback-rule-based' && ' (no API key configured — showing rule-based fallback)'}
          </div>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            style={{
              background: 'var(--accent-brand-dim)',
              color: 'var(--accent-brand)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 500,
              opacity: regenerating ? 0.6 : 1,
            }}
          >
            {regenerating ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SECTIONS.map((s) => (
          <div key={s.key} style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 3, borderRadius: 2, background: s.accent, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>{insight[s.key] as string}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
