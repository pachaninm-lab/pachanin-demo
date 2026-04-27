import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

const SURFACE = 'var(--pc-bg-card)';
const SURFACE_SOFT = 'var(--pc-bg-elevated)';
const BORDER = 'var(--pc-border)';
const TEXT = 'var(--pc-text-primary)';
const MUTED = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const DANGER = '#B91C1C';
const DANGER_BG = 'rgba(220,38,38,0.08)';
const DANGER_BORDER = 'rgba(220,38,38,0.18)';
const INFO = '#2563EB';
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';

export type P7Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

function tone(t: P7Tone) {
  if (t === 'success') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND };
  if (t === 'warning') return { bg: WARN_BG, border: WARN_BORDER, color: WARN };
  if (t === 'danger') return { bg: DANGER_BG, border: DANGER_BORDER, color: DANGER };
  if (t === 'info') return { bg: INFO_BG, border: INFO_BORDER, color: INFO };
  return { bg: SURFACE_SOFT, border: BORDER, color: TEXT };
}

export function P7PanelShell({ title, eyebrow, children, action, tone: panelTone = 'default' }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode; tone?: P7Tone }) {
  const p = tone(panelTone);
  return (
    <section style={{ background: SURFACE, border: `1px solid ${p.border}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          {eyebrow ? <div style={{ fontSize: 11, color: p.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{eyebrow}</div> : null}
          <div style={{ marginTop: eyebrow ? 6 : 0, fontSize: 20, fontWeight: 900, color: TEXT, lineHeight: 1.2 }}>{title}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function P7StatusPill({ children, tone: pillTone = 'default' }: { children: ReactNode; tone?: P7Tone }) {
  const p = tone(pillTone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 99, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

export function P7MetricCard({ label, value, note, tone: metricTone = 'default' }: { label: string; value: string; note?: string; tone?: P7Tone }) {
  const p = tone(metricTone);
  return (
    <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: p.color, lineHeight: 1.1 }}>{value}</div>
      {note ? <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>{note}</div> : null}
    </div>
  );
}

export function P7Notice({ title, children, tone: noticeTone = 'info' }: { title: string; children: ReactNode; tone?: P7Tone }) {
  const p = tone(noticeTone);
  return (
    <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 11, color: p.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: TEXT, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

export function P7LinkButton({ href, children, tone: buttonTone = 'default', style }: { href: string; children: ReactNode; tone?: P7Tone; style?: CSSProperties }) {
  const p = tone(buttonTone);
  return (
    <Link href={href} style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {children}
    </Link>
  );
}

export function P7Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>{children}</div>;
}
