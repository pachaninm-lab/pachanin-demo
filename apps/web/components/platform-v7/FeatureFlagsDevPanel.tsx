'use client';

import { useState, useEffect } from 'react';
import { getAllFlags, setFeatureOverride, clearFeatureOverride, type FeatureFlagId } from '@/lib/platform-v7/feature-flags';

// Internal verification panel. Hidden unless explicitly enabled.
export function FeatureFlagsDevPanel() {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState(() => getAllFlags());

  useEffect(() => {
    if (open) setFlags(getAllFlags());
  }, [open]);

  const isDev = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  if (!isDev) return null;

  return (
    <>
      <button
        data-internal-check="true"
        onClick={() => setOpen(!open)}
        title="Feature flags (internal check only)"
        aria-label="Переключить панель feature flags"
        style={{
          position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'var(--p7-color-surface-strong, #1B2B26)',
          border: '1px solid var(--p7-color-border-strong, #587169)',
          color: 'var(--p7-color-brand, #7DDDB5)',
          cursor: 'pointer', fontSize: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        🚩
      </button>

      {open && (
        <div
          data-internal-check="true"
          style={{
            position: 'fixed', bottom: '4rem', right: '1rem', zIndex: 9998,
            width: '320px', maxHeight: '70vh', overflow: 'auto',
            background: 'var(--p7-color-background-elevated, #111F1C)',
            border: '1px solid var(--p7-color-border, #24342F)',
            borderRadius: '12px', padding: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--pc-text-primary)' }}>
              Feature Flags
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pc-text-muted)', fontSize: '1rem' }}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '0.5rem', fontSize: '10px', color: 'var(--pc-text-muted)', lineHeight: 1.45 }}>
            🟡 <strong>внутренний ответ</strong> — режим проверки функции без внешней интеграции
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {flags.map(({ flag, enabled }) => (
              <div key={flag.id} style={{ borderRadius: '6px', overflow: 'hidden' }}>
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.375rem 0.5rem',
                    cursor: 'pointer', fontSize: 'var(--text-xs)',
                    background: flag.demoAnswer ? 'rgba(217,119,6,0.06)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const newEnabled = e.target.checked;
                      if (newEnabled === flag.defaultEnabled) {
                        clearFeatureOverride(flag.id as FeatureFlagId);
                      } else {
                        setFeatureOverride(flag.id as FeatureFlagId, newEnabled);
                      }
                      setFlags(getAllFlags());
                    }}
                    style={{ accentColor: 'var(--p7-color-brand)' }}
                  />
                  <span style={{ flex: 1, color: 'var(--pc-text-secondary)' }}>
                    {flag.label}
                  </span>
                  {flag.demoAnswer && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#B45309', background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 999, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                      внутренняя проверка
                    </span>
                  )}
                  {enabled !== flag.defaultEnabled && (
                    <span style={{ fontSize: '9px', color: 'var(--status-warning-text)', fontWeight: 700 }}>override</span>
                  )}
                  {flag.demoOnly && !flag.demoAnswer && (
                    <span style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>internal</span>
                  )}
                </label>
                {flag.demoAnswer && flag.demoNote && (
                  <div style={{ fontSize: '9px', color: '#92400E', padding: '0 0.5rem 0.375rem 1.75rem', lineHeight: 1.4, background: 'rgba(217,119,6,0.06)' }}>
                    {flag.demoNote}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--p7-color-border)' }}>
            <button
              onClick={() => {
                import('@/lib/platform-v7/feature-flags').then(({ FEATURE_FLAGS }) => {
                  FEATURE_FLAGS.forEach((f) => clearFeatureOverride(f.id as FeatureFlagId));
                  setFlags(getAllFlags());
                });
              }}
              style={{
                fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)',
                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Сбросить все overrides
            </button>
          </div>
        </div>
      )}
    </>
  );
}
