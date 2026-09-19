'use client';

import { useState } from 'react';

interface Props {
  documentName: string;
  documentType: string;
  documentId: string;
  signedBy?: string;
  signedAt?: string;
  watermark?: string;
}

const TYPE_ICON: Record<string, string> = {
  pdf:  '📄',
  xlsx: '📊',
  docx: '📝',
  tiff: '🖼',
  default: '📎',
};

function getIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? 'default';
  return TYPE_ICON[ext] ?? TYPE_ICON.default;
}

export function DocumentPdfPreview({ documentName, documentType, documentId, signedBy, signedAt, watermark }: Props) {
  const [open, setOpen] = useState(false);
  const isPdf = documentName.endsWith('.pdf') || documentType.toLowerCase().includes('pdf');

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Просмотр документа ${documentName}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          padding: '4px 10px', borderRadius: 8,
          background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)',
          fontSize: 10, fontWeight: 700, color: 'var(--pc-text-secondary)',
          cursor: 'pointer',
        }}
      >
        {getIcon(documentName)} Просмотр
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Документ: ${documentName}`}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680,
            maxHeight: '85vh', overflow: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            display: 'grid',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--p7-color-border, #E4E6EA)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{documentName}</div>
                <div style={{ fontSize: 10, color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>{documentId} · {documentType}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--pc-text-muted)', lineHeight: 1 }} aria-label="Закрыть">✕</button>
            </div>

            {/* Preview area */}
            <div style={{ padding: '1.5rem 1.25rem', position: 'relative' }}>
              {/* Watermark */}
              {watermark && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    fontSize: 64, fontWeight: 900, color: 'rgba(10,122,95,0.08)',
                    transform: 'rotate(-35deg)', letterSpacing: '-0.02em',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                    {watermark}
                  </div>
                </div>
              )}

              {/* Simulated PDF pages */}
              <div style={{ display: 'grid', gap: '0.875rem', position: 'relative', zIndex: 2 }}>
                {[1, 2].map((page) => (
                  <div
                    key={page}
                    style={{
                      background: '#FAFAFA',
                      border: '1px solid #E4E6EA',
                      borderRadius: 10,
                      padding: '1.5rem',
                      minHeight: 240,
                      position: 'relative',
                    }}
                  >
                    {page === 1 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 900, color: '#0F1419', marginBottom: 4 }}>{documentType}</div>
                            <div style={{ fontSize: 9, color: '#6B778C', fontFamily: 'monospace' }}>{documentId}</div>
                          </div>
                          <div style={{ fontSize: 9, color: '#0A7A5F', fontWeight: 700, border: '1px solid rgba(10,122,95,0.2)', borderRadius: 6, padding: '2px 6px', background: 'rgba(10,122,95,0.06)' }}>
                            {isPdf ? 'PDF / Демо-контур' : 'Документ'}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.375rem' }}>
                          {['█████████████████████████', '████████████████', '█████████████████████', '████████'].map((line, i) => (
                            <div key={i} style={{ height: 8, borderRadius: 4, background: '#E4E6EA', width: line.length * 5 + 'px', maxWidth: '100%' }} />
                          ))}
                        </div>
                        {signedBy && (
                          <div style={{ marginTop: '1.25rem', padding: '0.625rem 0.75rem', borderRadius: 8, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.15)' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#0A7A5F' }}>✓ Подписан КЭП · {signedBy}</div>
                            {signedAt && <div style={{ fontSize: 8, color: '#6B778C', marginTop: 2 }}>{new Date(signedAt).toLocaleString('ru-RU')}</div>}
                          </div>
                        )}
                      </>
                    )}
                    {page === 2 && (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {['████████████████████████████', '██████████████████████', '█████████████████'].map((line, i) => (
                          <div key={i} style={{ height: 8, borderRadius: 4, background: '#E4E6EA', width: line.length * 5 + 'px', maxWidth: '100%' }} />
                        ))}
                        <div style={{ marginTop: '0.75rem', fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Стр. 2 из 2</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 8, color: '#CBD5E1' }}>Стр. {page}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--p7-color-border, #E4E6EA)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 9, color: 'var(--pc-text-muted)' }}>
                Предпросмотр · Боевые документы доступны после подключения ЭДО-контура
              </div>
              <button onClick={() => setOpen(false)} style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: '#0A7A5F', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
