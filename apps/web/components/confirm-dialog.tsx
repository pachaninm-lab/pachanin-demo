'use client';

import { ReactNode, useState } from 'react';

type RenderTrigger = (open: () => void) => ReactNode;

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  onConfirm,
  children,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  children: RenderTrigger;
}) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpened(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {children(() => setOpened(true))}
      {opened ? (
        <div className="dialog-overlay">
          <div className="dialog-card">
            <div className="section-title">{title}</div>
            <div className="muted small" style={{ marginTop: 8 }}>{message}</div>
            <div className="cta-stack" style={{ marginTop: 16 }}>
              <button onClick={confirm} disabled={loading} className="button primary compact">{loading ? '…' : confirmLabel}</button>
              <button onClick={() => setOpened(false)} disabled={loading} className="button secondary compact">{cancelLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
