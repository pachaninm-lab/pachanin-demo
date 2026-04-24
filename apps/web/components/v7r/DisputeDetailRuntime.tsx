'use client';

import * as React from 'react';
import Link from 'next/link';
import { getDisputeById } from '@/lib/v7r/data';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';

const DOCS_CHECKLIST = [
  'Контракт купли-продажи',
  'Лабораторный протокол (ФГИС)',
  'Акт сюрвейера',
  'Банковская выписка резерва',
  'Ответная позиция контрагента',
];

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DisputeDetailRuntime({ disputeId }: { disputeId: string }) {
  const toast = useToast();
  const dispute = getDisputeById(disputeId);
  const [showPackage, setShowPackage] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<number>>(new Set([0, 1, 2]));
  const [reminderSent, setReminderSent] = React.useState(false);

  function toggleDoc(i: number) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleReminder() {
    setReminderSent(true);
    trackEvent('dispute_reminder_sent', { disputeId });
    toast('Напоминание отправлено контрагенту', 'success');
  }

  function handlePackageDownload() {
    if (!dispute) return;
    const selectedDocs = DOCS_CHECKLIST.filter((_, i) => checked.has(i));
    const missingDocs = DOCS_CHECKLIST.filter((_, i) => !checked.has(i));
    const content = [
      `Пакет доказательств по спору ${dispute.id}`,
      `Сделка: ${dispute.dealId}`,
      `Причина: ${dispute.reasonCode}`,
      `Статус: ${dispute.status === 'open' ? 'Открыт' : 'Закрыт'}`,
      `Удержано: ${formatMoney(dispute.holdAmount)}`,
      `SLA осталось: ${dispute.slaDaysLeft} дн.`,
      `Мяч у: ${dispute.ballAt}`,
      '',
      'Описание:',
      dispute.description,
      '',
      `Загружено документов: ${checked.size}/${DOCS_CHECKLIST.length}`,
      ...selectedDocs.map((doc) => `✓ ${doc}`),
      '',
      'Недостающие документы:',
      ...(missingDocs.length ? missingDocs.map((doc) => `— ${doc}`) : ['— нет']),
      '',
      `Сформировано: ${new Date().toISOString()}`,
    ].join('\n');

    downloadTextFile(`evidence-pack-${dispute.id}.txt`, content);
    trackEvent('dispute_package_downloaded', { disputeId, docs: checked.size });
    toast(`Пакет доказательств ${checked.size}/${DOCS_CHECKLIST.length} скачан`, 'success');
    setShowPackage(false);
  }

  if (!dispute) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Спор {disputeId}</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 8 }}>Данные по спору не найдены.</div>
          <Link href='/platform-v7/disputes' style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 800, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>{dispute.id}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{dispute.title}</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>{dispute.reasonCode} · сделка <Link href={`/platform-v7/deals/${dispute.dealId}`} style={{ color: 'var(--pc-accent)', fontWeight: 700 }}>{dispute.dealId}</Link></div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: dispute.status === 'open' ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${dispute.status === 'open' ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, color: dispute.status === 'open' ? '#B91C1C' : '#0A7A5F', fontSize: 12, fontWeight: 800 }}>
            {dispute.status === 'open' ? 'Открыт' : 'Закрыт'}
          </span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Удержано', value: formatMoney(dispute.holdAmount) },
          { label: 'SLA осталось', value: `${dispute.slaDaysLeft} дн.` },
          { label: 'Доказательства', value: `${dispute.evidence.uploaded}/${dispute.evidence.total}` },
          { label: 'Мяч у', value: dispute.ballAt },
        ].map(({ label, value }) => (
          <section key={label} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{value}</div>
          </section>
        ))}
      </div>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.7 }}>{dispute.description}</div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Пакет доказательств ({dispute.evidence.uploaded}/{dispute.evidence.total})</div>
        {!showPackage ? (
          <button onClick={() => setShowPackage(true)} style={{ alignSelf: 'start', padding: '10px 16px', borderRadius: 12, border: 'none', background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Сформировать пакет доказательств
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)' }}>Отметьте документы, которые войдут в скачиваемый пакет:</div>
            {DOCS_CHECKLIST.map((doc, i) => (
              <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: checked.has(i) ? 'rgba(10,122,95,0.06)' : 'var(--pc-bg-subtle)', border: `1px solid ${checked.has(i) ? 'rgba(10,122,95,0.18)' : 'var(--pc-border)'}`, cursor: 'pointer' }}>
                <input type='checkbox' checked={checked.has(i)} onChange={() => toggleDoc(i)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: checked.has(i) ? 700 : 400, color: 'var(--pc-text-primary)' }}>{doc}</span>
                {checked.has(i) && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#0A7A5F', fontWeight: 700 }}>✓ в пакете</span>}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handlePackageDownload} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                Скачать пакет ({checked.size}/{DOCS_CHECKLIST.length})
              </button>
              <button onClick={() => setShowPackage(false)} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleReminder} disabled={reminderSent} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.08)', color: reminderSent ? '#9CA3AF' : '#2563EB', fontSize: 13, fontWeight: 800, cursor: reminderSent ? 'default' : 'pointer' }}>
          {reminderSent ? 'Напоминание отправлено ✓' : 'Отправить напоминание'}
        </button>
        <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
      </div>
    </div>
  );
}
