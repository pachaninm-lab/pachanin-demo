'use client';

import * as React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Подтвердить', danger = false, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,20,25,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, border: '1px solid #E4E6EA', padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 16px 40px rgba(9,30,66,0.18)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginBottom: 8 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, marginBottom: 20 }}>{description}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
          <button onClick={() => { onConfirm(); }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: danger ? '#DC2626' : '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
