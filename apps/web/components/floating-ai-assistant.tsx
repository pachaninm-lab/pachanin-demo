'use client';

import Link from 'next/link';
import { useState } from 'react';

export function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60 }}>
      {open ? (
        <div className="section-card-tight" style={{ width: 320 }}>
          <div className="list-row"><b>Помощник</b><button className="mini-chip" onClick={() => setOpen(false)}>Закрыть</button></div>
          <div className="muted small" style={{ marginTop: 8 }}>Открывай роль, сделку, документы, payments или support из ближайшего рабочего контура.</div>
          <div className="cta-stack" style={{ marginTop: 12 }}>
            <Link href="/assistant" className="primary-link">Открыть assistant</Link>
            <Link href="/operator-cockpit" className="secondary-link">Operator cockpit</Link>
          </div>
        </div>
      ) : (
        <button className="button primary compact" onClick={() => setOpen(true)}>Assistant</button>
      )}
    </div>
  );
}
