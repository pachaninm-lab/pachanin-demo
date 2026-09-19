'use client';

import { useState } from 'react';

export function DisputeActions({ onResolve, onEscalate }: { onResolve?: () => Promise<void> | void; onEscalate?: () => Promise<void> | void }) {
  const [busy, setBusy] = useState('');
  async function run(kind: 'resolve' | 'escalate') {
    setBusy(kind);
    try {
      if (kind === 'resolve') await onResolve?.();
      else await onEscalate?.();
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="cta-stack">
      <button className="button primary" onClick={() => run('resolve')} disabled={!!busy}>{busy === 'resolve' ? '...' : 'Закрыть спор'}</button>
      <button className="button secondary" onClick={() => run('escalate')} disabled={!!busy}>{busy === 'escalate' ? '...' : 'Эскалировать'}</button>
    </div>
  );
}
