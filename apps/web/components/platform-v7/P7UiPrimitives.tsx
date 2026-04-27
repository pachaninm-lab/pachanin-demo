import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

export function P7PanelShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, ...style }}>
      {children}
    </section>
  );
}

export function P7StatusPill({ children, tone = 'default' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'default' }) {
  const palettes = {
    green:   { bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.18)',  color: '#15803D' },
    amber:   { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.18)',  color: '#B45309' },
    red:     { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.18)',  color: '#B91C1C' },
    default: { bg: 'var(--pc-bg-elevated)', border: 'var(--pc-border)',      color: 'var(--pc-text-secondary)' },
  };
  const p = palettes[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: p.bg, border: `1px solid ${p.border}`, color: p.color }}>
      {children}
    </span>
  );
}

export function P7MetricCard({ title, value, note, tone = 'default' }: { title: string; value: string; note?: string; tone?: 'green' | 'red' | 'default' }) {
  const bg = tone === 'green' ? 'rgba(22,163,74,0.06)' : tone === 'red' ? 'rgba(220,38,38,0.06)' : 'var(--pc-bg-card)';
  const border = tone === 'green' ? 'rgba(22,163,74,0.18)' : tone === 'red' ? 'rgba(220,38,38,0.18)' : 'var(--pc-border)';
  const valueColor = tone === 'green' ? '#15803D' : tone === 'red' ? '#B91C1C' : 'var(--pc-text-primary)';
  return (
    <section style={{ background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: valueColor }}>{value}</div>
      {note && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--pc-text-secondary)' }}>{note}</div>}
    </section>
  );
}

export function P7Notice({ title, children, tone = 'amber' }: { title: string; children: ReactNode; tone?: 'amber' | 'red' | 'green' | 'blue' }) {
  const palettes = {
    amber: { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.18)',  color: '#B45309' },
    red:   { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.18)',  color: '#B91C1C' },
    green: { bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.18)',  color: '#15803D' },
    blue:  { bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.18)',  color: '#1D4ED8' },
  };
  const p = palettes[tone];
  return (
    <section style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: p.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--pc-text-primary)', lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}

export function P7LinkButton({ href, children, kind = 'default' }: { href: string; children: ReactNode; kind?: 'default' | 'primary' }) {
  const style = kind === 'primary'
    ? { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 13, fontWeight: 700, display: 'inline-block' } as const
    : { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700, display: 'inline-block' } as const;
  return <Link href={href} style={style}>{children}</Link>;
}

export function P7Grid({ children, min = 200, gap = 14 }: { children: ReactNode; min?: number; gap?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap }}>
      {children}
    </div>
  );
}
