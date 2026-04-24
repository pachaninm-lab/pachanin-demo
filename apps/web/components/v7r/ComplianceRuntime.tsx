'use client';

import * as React from 'react';
import Link from 'next/link';
import { DEALS } from '@/lib/v7r/data';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';

const COUNTERPARTIES = [
  { inn: '6829123456', name: 'Агрохолдинг СК', status: 'verified', risk: 'low', deals: 12, lastCheck: '2026-04-01', actor: 'Комплаенс' },
  { inn: '3664098765', name: 'МаслоПресс ООО', status: 'verified', risk: 'low', deals: 8, lastCheck: '2026-03-28', actor: 'Оператор' },
  { inn: '4632198234', name: 'ГрейнТрейд ЗАО', status: 'review', risk: 'medium', deals: 3, lastCheck: '2026-04-10', actor: 'Банк' },
  { inn: '7701234567', name: 'ПромАгро АО', status: 'verified', risk: 'low', deals: 21, lastCheck: '2026-03-15', actor: 'Комплаенс' },
  { inn: '2301456789', name: 'КубаньЗерно ООО', status: 'blocked', risk: 'high', deals: 0, lastCheck: '2026-04-12', actor: 'Комплаенс' },
  { inn: '6820987654', name: 'ТамбовАгро ИП', status: 'verified', risk: 'low', deals: 5, lastCheck: '2026-04-05', actor: 'Оператор' },
] as const;

const ACTORS = ['Все ответственные', 'Комплаенс', 'Оператор', 'Банк'];

function riskPalette(risk: string) {
  if (risk === 'low') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'Низкий' };
  if (risk === 'medium') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Средний' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Высокий' };
}

function statusPalette(status: string) {
  if (status === 'verified') return { color: '#0A7A5F', label: 'Верифицирован' };
  if (status === 'review') return { color: '#B45309', label: 'На проверке' };
  return { color: '#B91C1C', label: 'Заблокирован' };
}

function downloadCsv(data: typeof COUNTERPARTIES[number][]) {
  const header = ['ИНН', 'Наименование', 'Статус', 'Риск', 'Сделок', 'Последняя проверка', 'Ответственный'];
  const rows = data.map(r => [r.inn, r.name, statusPalette(r.status).label, riskPalette(r.risk).label, String(r.deals), r.lastCheck, r.actor]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compliance_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function inDateRange(date: string, from: string, to: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function Badge({ bg, border, color, label }: { bg: string; border: string; color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 800 }}>
      {label}
    </span>
  );
}

export function ComplianceRuntime() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<'all' | 'review' | 'blocked'>('all');
  const [actor, setActor] = React.useState('Все ответственные');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const filtered = COUNTERPARTIES.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (actor !== 'Все ответственные' && c.actor !== actor) return false;
    return inDateRange(c.lastCheck, dateFrom, dateTo);
  });
  const verified = COUNTERPARTIES.filter(c => c.status === 'verified').length;
  const review = COUNTERPARTIES.filter(c => c.status === 'review').length;
  const blocked = COUNTERPARTIES.filter(c => c.status === 'blocked').length;

  function handleCsv() {
    downloadCsv(filtered);
    trackEvent('compliance_csv_exported', { count: filtered.length, actor, dateFrom, dateTo });
    toast(`CSV выгружен: ${filtered.length} строк`, 'success');
  }

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Комплаенс</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', lineHeight: 1.7, marginTop: 8 }}>KYB-проверка, верификация контрагентов, экспорт реестра.</div>
          </div>
          <button onClick={handleCsv} style={{ borderRadius: 12, padding: '10px 16px', background: 'var(--pc-accent)', border: '1px solid var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Выгрузить CSV
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { title: 'Верифицированы', value: verified, color: '#0A7A5F' },
          { title: 'На проверке', value: review, color: '#B45309' },
          { title: 'Заблокированы', value: blocked, color: '#B91C1C' },
          { title: 'Всего сделок', value: DEALS.length, color: 'var(--pc-text-primary)' },
        ].map(({ title, value, color }) => (
          <section key={title} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
          </section>
        ))}
      </div>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Реестр контрагентов</div>
            <div style={{ fontSize: 12, color: 'var(--pc-text-muted)', marginTop: 4 }}>Показано {filtered.length} из {COUNTERPARTIES.length} записей.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'review', 'blocked'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${filter === f ? 'var(--pc-accent)' : 'var(--pc-border)'}`, background: filter === f ? 'var(--pc-accent-bg)' : 'transparent', color: filter === f ? 'var(--pc-accent)' : 'var(--pc-text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {f === 'all' ? 'Все' : f === 'review' ? 'Проверка' : 'Заблокированы'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          <select value={actor} onChange={(e) => setActor(e.target.value)} style={inputStyle()}>
            {ACTORS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle()} />
          <input type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle()} />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(c => {
            const risk = riskPalette(c.risk);
            const st = statusPalette(c.status);
            return (
              <div key={c.inn} style={{ background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontFamily: 'monospace' }}>ИНН {c.inn}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge {...risk} label={`Риск: ${risk.label}`} />
                    <span style={{ fontSize: 12, color: st.color, fontWeight: 700 }}>{st.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--pc-text-muted)' }}>{c.deals} сделок · проверен {c.lastCheck} · {c.actor}</span>
                  </div>
                </div>
                <Link href={`/platform-v7/deals?counterparty=${c.inn}`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Сделки →
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 10,
    padding: '8px 10px',
    border: '1px solid var(--pc-border)',
    background: 'var(--pc-bg-card)',
    color: 'var(--pc-text-primary)',
    fontSize: 13,
    fontWeight: 700,
  };
}
