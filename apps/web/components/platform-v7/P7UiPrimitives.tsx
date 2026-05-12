import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

const cardSurface: CSSProperties = {
  background: 'linear-gradient(180deg, var(--pc-bg-card) 0%, var(--pc-bg-elevated) 100%)',
  border: '1px solid var(--pc-border)',
  boxShadow: '0 14px 34px rgba(15,23,42,0.06)',
};

export function P7PanelShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...cardSurface, borderRadius: 20, padding: 20, ...style }}>
      {children}
    </section>
  );
}

export function P7StatusPill({ children, tone = 'default' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'default' }) {
  const palettes = {
    green: { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)', color: '#15803D' },
    amber: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
    red: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' },
    default: { bg: 'var(--pc-bg-elevated)', border: 'var(--pc-border)', color: 'var(--pc-text-secondary)' },
  };
  const p = palettes[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 26, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 850, letterSpacing: '0.01em', background: p.bg, border: `1px solid ${p.border}`, color: p.color, boxShadow: '0 1px 0 rgba(15,23,42,0.03)' }}>
      {children}
    </span>
  );
}

export function P7MetricCard({ title, value, note, tone = 'default' }: { title: string; value: string; note?: string; tone?: 'green' | 'red' | 'default' }) {
  const bg = tone === 'green' ? 'linear-gradient(180deg, rgba(22,163,74,0.07) 0%, var(--pc-bg-card) 100%)' : tone === 'red' ? 'linear-gradient(180deg, rgba(220,38,38,0.07) 0%, var(--pc-bg-card) 100%)' : 'linear-gradient(180deg, var(--pc-bg-card) 0%, var(--pc-bg-elevated) 100%)';
  const border = tone === 'green' ? 'rgba(22,163,74,0.18)' : tone === 'red' ? 'rgba(220,38,38,0.18)' : 'var(--pc-border)';
  const valueColor = tone === 'green' ? '#15803D' : tone === 'red' ? '#B91C1C' : 'var(--pc-text-primary)';
  return (
    <section style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: 18, boxShadow: '0 12px 28px rgba(15,23,42,0.05)' }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1.05, fontWeight: 900, color: valueColor }}>{value}</div>
      {note ? <div style={{ marginTop: 10, fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>{note}</div> : null}
    </section>
  );
}

export function P7Notice({ title, children, tone = 'amber' }: { title: string; children: ReactNode; tone?: 'amber' | 'red' | 'green' | 'blue' }) {
  const palettes = {
    amber: { bg: 'linear-gradient(180deg, rgba(217,119,6,0.09) 0%, rgba(217,119,6,0.045) 100%)', border: 'rgba(217,119,6,0.20)', color: '#B45309' },
    red: { bg: 'linear-gradient(180deg, rgba(220,38,38,0.09) 0%, rgba(220,38,38,0.045) 100%)', border: 'rgba(220,38,38,0.20)', color: '#B91C1C' },
    green: { bg: 'linear-gradient(180deg, rgba(22,163,74,0.09) 0%, rgba(22,163,74,0.045) 100%)', border: 'rgba(22,163,74,0.20)', color: '#15803D' },
    blue: { bg: 'linear-gradient(180deg, rgba(37,99,235,0.09) 0%, rgba(37,99,235,0.045) 100%)', border: 'rgba(37,99,235,0.20)', color: '#1D4ED8' },
  };
  const p = palettes[tone];
  return (
    <section style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 16, padding: 16, boxShadow: '0 10px 24px rgba(15,23,42,0.045)' }}>
      <div style={{ fontSize: 12, color: p.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-primary)', lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

export function P7LinkButton({ href, children, kind = 'default' }: { href: string; children: ReactNode; kind?: 'default' | 'primary' }) {
  const base: CSSProperties = {
    textDecoration: 'none',
    borderRadius: 14,
    padding: '10px 14px',
    minHeight: 42,
    fontSize: 13,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.2,
    boxShadow: '0 8px 18px rgba(15,23,42,0.04)',
  };
  const style = kind === 'primary'
    ? { ...base, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)' }
    : { ...base, background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)' };
  return <Link href={href} style={style}>{children}</Link>;
}

export function P7Grid({ children, min = 200, gap = 14 }: { children: ReactNode; min?: number; gap?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap }}>{children}</div>;
}
