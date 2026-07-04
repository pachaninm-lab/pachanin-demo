import type { ReactNode } from 'react';

// Токен-ориентированные примитивы консолей (админ / оператор). Единый визуальный
// язык вместо захардкоженных hex и system-ui: всё берётся из --pc-* (theme.css),
// поэтому автоматически работает светлая и тёмная тема и держится 8pt-ритм.

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONE_FG: Record<Tone, string> = {
  ok: 'var(--pc-success)',
  warn: 'var(--pc-warning)',
  danger: 'var(--pc-danger)',
  info: 'var(--pc-info)',
  neutral: 'var(--pc-text-muted)',
};
const TONE_BG: Record<Tone, string> = {
  ok: 'var(--pc-success-bg)',
  warn: 'var(--pc-warning-bg)',
  danger: 'var(--pc-danger-bg)',
  info: 'var(--pc-info-bg)',
  neutral: 'var(--pc-bg-subtle)',
};

export function ConsolePage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: 'var(--pc-space-5) var(--pc-space-4) var(--pc-space-7)',
        display: 'grid',
        gap: 'var(--pc-space-5)',
        color: 'var(--pc-text-primary)',
        fontFamily: 'var(--pc-font-family)',
      }}
    >
      <header>
        <h1 style={{ margin: 0, fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--pc-text-secondary)', lineHeight: 1.5, maxWidth: 640 }}>{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 'var(--pc-space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--pc-space-3)', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: '0.01em', color: 'var(--pc-text-primary)' }}>{title}</h2>
        {hint && <span style={{ fontSize: 12.5, color: 'var(--pc-text-muted)', fontWeight: 600 }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Banner({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div
      style={{
        padding: 'var(--pc-space-3) var(--pc-space-4)',
        borderRadius: 'var(--pc-radius-md)',
        border: `1px solid ${TONE_FG[tone]}`,
        background: TONE_BG[tone],
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 900, color: TONE_FG[tone] }}>{title}</div>
      {children && <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--pc-space-3)' }}>{children}</div>
  );
}

export function Stat({ label, value, tone = 'neutral', foot }: { label: string; value: string; tone?: Tone; foot?: string }) {
  return (
    <div
      style={{
        padding: 'var(--pc-space-4)',
        borderRadius: 'var(--pc-radius-lg)',
        border: '1px solid var(--pc-border)',
        background: 'var(--pc-bg-card)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--pc-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: tone === 'neutral' ? 'var(--pc-text-primary)' : TONE_FG[tone], lineHeight: 1 }}>{value}</div>
      {foot && <div style={{ fontSize: 12, color: 'var(--pc-text-muted)' }}>{foot}</div>}
    </div>
  );
}

export function StatusRow({ name, tone, detail }: { name: string; tone: Tone; detail: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--pc-space-3)',
        padding: 'var(--pc-space-3) var(--pc-space-4)',
        borderRadius: 'var(--pc-radius-md)',
        border: '1px solid var(--pc-border)',
        background: 'var(--pc-bg-elevated)',
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: TONE_FG[tone], flexShrink: 0 }} aria-hidden />
      <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 128, flexShrink: 0, color: 'var(--pc-text-primary)' }}>{name}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: TONE_FG[tone], textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 74 }}>
        {tone === 'ok' ? 'OK' : tone === 'warn' ? 'ВНИМАНИЕ' : tone === 'danger' ? 'СТОП' : '—'}
      </span>
      <span style={{ fontSize: 13, color: 'var(--pc-text-secondary)', overflowWrap: 'anywhere' }}>{detail}</span>
    </div>
  );
}

export function LinkGrid({ links }: { links: Array<{ label: string; href: string; note: string }> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--pc-space-3)' }}>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          style={{
            display: 'grid',
            gap: 3,
            padding: 'var(--pc-space-4)',
            minHeight: 44,
            borderRadius: 'var(--pc-radius-md)',
            border: '1px solid var(--pc-border)',
            background: 'var(--pc-bg-card)',
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{l.label}</span>
          <span style={{ fontSize: 12.5, color: 'var(--pc-text-muted)' }}>{l.note}</span>
        </a>
      ))}
    </div>
  );
}
