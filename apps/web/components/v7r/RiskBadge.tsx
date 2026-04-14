'use client';

import * as React from 'react';

function getRiskStyle(score: number) {
  if (score >= 61) return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
  if (score >= 31) return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' };
}

export function RiskBadge({ score }: { score: number }) {
  const s = getRiskStyle(score);
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center',
    }}>
      {score}
    </span>
  );
}
