'use client';
import * as React from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

/**
 * Global SANDBOX marker shown in the header.
 * Includes a "Выйти из SANDBOX" affordance so visitors understand the
 * demo mode is explicit and reversible.
 */
export function SandboxBanner() {
  const demoMode = useSessionStore(s => s.demoMode);
  const setDemoMode = useSessionStore(s => s.setDemoMode);

  if (!demoMode) return null;

  return (
    <div
      role="status"
      aria-label="Демонстрационный режим"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 4,
        background: 'rgba(217,119,6,0.1)',
        border: '1px solid rgba(217,119,6,0.3)',
        fontSize: 11,
        fontWeight: 700,
        color: '#D97706',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#D97706',
          animation: 'pulse 2s infinite',
        }}
      />
      <span>SANDBOX · Демо-данные</span>
      <button
        type="button"
        onClick={() => {
          setDemoMode(false);
          toast('Переключено в LIVE-режим. Подключите реальный API.');
        }}
        style={{
          marginLeft: 4,
          fontSize: 10,
          color: '#D97706',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 0,
          fontWeight: 600,
        }}
        title="Переключиться в LIVE-режим (без демо-данных)"
      >
        Выйти
      </button>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
