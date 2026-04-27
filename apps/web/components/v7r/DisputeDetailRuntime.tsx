'use client';

import * as React from 'react';
import Link from 'next/link';
import { P7ActionLog } from '@/components/platform-v7/P7ActionLog';
import { P7EvidenceProjectionPanel } from '@/components/platform-v7/P7EvidenceProjectionPanel';
import { createActionLogEntry, type PlatformActionLogEntry } from '@/lib/platform-v7/action-log';
import { selectDisputeById } from '@/lib/domain/selectors';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';
import { buildEvidencePackReadinessUiModel, type P7EvidenceUiTone } from '@/lib/v7r/evidence-pack-ui';

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function tonePalette(tone: P7EvidenceUiTone) {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: 'var(--pc-bg-subtle)', border: 'var(--pc-border)', color: 'var(--pc-text-secondary)' };
}

function EvidenceReadinessBadge({ tone, children }: { tone: P7EvidenceUiTone; children: React.ReactNode }) {
  const p = tonePalette(tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 12, fontWeight: 800 }}>
      {children}
    </span>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{value}</div>
    </div>
  );
}

export function DisputeDetailRuntime({ disputeId }: { disputeId: string }) {
  const toast = useToast();
  const dispute = selectDisputeById(disputeId);
  const [reminderSent, setReminderSent] = React.useState(false);
  const [snapshotLog, setSnapshotLog] = React.useState<PlatformActionLogEntry[]>([]);
  const evidenceUi = React.useMemo(() => buildEvidencePackReadinessUiModel(disputeId), [disputeId]);

  function handleReminder() {
    setReminderSent(true);
    trackEvent('dispute_reminder_sent', { disputeId });
    toast('Напоминание отправлено контрагенту', 'success');
  }

  function handlePackageDownload() {
    if (!dispute) return;
    const content = [
      `Пакет доказательств по спору ${dispute.id}`,
      `Сделка: ${dispute.dealId}`,
      `Причина: ${dispute.reasonCode}`,
      `Статус readiness: ${evidenceUi.statusLabel}`,
      `Readiness score: ${evidenceUi.scoreLabel}`,
      `Required: ${evidenceUi.requiredLabel}`,
      `Удержано: ${formatMoney(dispute.holdAmount)}`,
      `SLA осталось: ${dispute.slaDaysLeft} дн.`,
      `Мяч у: ${dispute.ballAt}`,
      '',
      'Ограничение зрелости:',
      ...evidenceUi.limitations.map((item) => `— ${item}`),
      '',
      'Blockers:',
      ...(evidenceUi.blockers.length ? evidenceUi.blockers.map((item) => `— ${item}`) : ['— нет']),
      '',
      'Evidence objects:',
      ...(evidenceUi.items.length
        ? evidenceUi.items.map((item) => [
          `— ${item.id}: ${item.title}`,
          `  type=${item.typeLabel}; source=${item.sourceLabel}; trust=${item.trustLabel}`,
          `  hash=${item.hashLabel}; actor=${item.actorLabel}; version=${item.versionLabel}; ${item.immutableLabel}`,
          `  captured=${item.capturedAtLabel}; uploaded=${item.uploadedAtLabel}; geo=${item.geoLabel}; chain=${item.chainLabel}`,
          item.issueLabels.length ? `  issues=${item.issueLabels.join('; ')}` : '  issues=нет',
        ].join('\n'))
        : ['— нет объектов evidence для этого disputeId']),
      '',
      `Сформировано: ${new Date().toISOString()}`,
    ].join('\n');

    downloadTextFile(`evidence-readiness-${dispute.id}.txt`, content);
    const logEntry = createActionLogEntry({
      scope: 'dispute',
      status: 'success',
      objectId: dispute.id,
      action: 'evidence-readiness-snapshot-download',
      actor: 'operator-runtime',
      message: `Readiness snapshot downloaded: ${evidenceUi.scoreLabel}, ${evidenceUi.totalLabel}.`,
    });
    setSnapshotLog((current) => [logEntry, ...current].slice(0, 4));
    trackEvent('dispute_package_downloaded', { disputeId, evidenceObjects: evidenceUi.items.length, readiness: evidenceUi.scoreLabel });
    toast(`Evidence readiness ${evidenceUi.scoreLabel} скачан`, 'success');
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
    <div style={{ display: 'grid', gap: 16, maxWidth: 920, margin: '0 auto' }}>
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
          { label: 'Evidence readiness', value: evidenceUi.scoreLabel },
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

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Evidence readiness</div>
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>Объектный пакет доказательств для controlled pilot. Это не live storage, не файловая загрузка и не квалифицированная электронная подпись.</div>
          </div>
          <EvidenceReadinessBadge tone={evidenceUi.statusTone}>{evidenceUi.statusLabel}</EvidenceReadinessBadge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <EvidenceMetric label='Score' value={evidenceUi.scoreLabel} />
          <EvidenceMetric label='Required' value={evidenceUi.requiredLabel} />
          <EvidenceMetric label='Total' value={evidenceUi.totalLabel} />
        </div>

        {evidenceUi.blockers.length > 0 && (
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.16)', display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Blockers</div>
            {evidenceUi.blockers.map((item) => <div key={item} style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>— {item}</div>)}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {evidenceUi.items.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', fontSize: 13, color: 'var(--pc-text-muted)' }}>Для этого disputeId нет stable evidence objects.</div>
          ) : evidenceUi.items.map((item) => (
            <article key={item.id} style={{ padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.id}</div>
                </div>
                <EvidenceReadinessBadge tone={item.issueLabels.length ? 'danger' : 'success'}>{item.issueLabels.length ? 'issue' : 'valid'}</EvidenceReadinessBadge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <EvidenceMetric label='Type' value={item.typeLabel} />
                <EvidenceMetric label='Source' value={item.sourceLabel} />
                <EvidenceMetric label='Trust' value={item.trustLabel} />
                <EvidenceMetric label='Actor' value={item.actorLabel} />
                <EvidenceMetric label='Geo' value={item.geoLabel} />
                <EvidenceMetric label='Chain' value={item.chainLabel} />
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--pc-text-muted)', overflowWrap: 'anywhere' }}>{item.hashLabel} · {item.versionLabel} · {item.immutableLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>captured: {item.capturedAtLabel} · uploaded: {item.uploadedAtLabel} · signature: {item.signatureLabel}</div>
            </article>
          ))}
        </div>

        <div style={{ padding: 14, borderRadius: 14, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.16)', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Граница зрелости</div>
          {evidenceUi.limitations.map((item) => <div key={item} style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>— {item}</div>)}
        </div>

        <button onClick={handlePackageDownload} style={{ justifySelf: 'start', padding: '10px 16px', borderRadius: 12, border: 'none', background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          Скачать readiness snapshot
        </button>

        <P7ActionLog title='Журнал readiness snapshot' entries={snapshotLog} emptyLabel='Snapshot ещё не скачивали.' maxEntries={4} />
      </section>

      <P7EvidenceProjectionPanel disputeId={disputeId} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleReminder} disabled={reminderSent} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.08)', color: reminderSent ? '#9CA3AF' : '#2563EB', fontSize: 13, fontWeight: 800, cursor: reminderSent ? 'default' : 'pointer' }}>
          {reminderSent ? 'Напоминание отправлено ✓' : 'Отправить напоминание'}
        </button>
        <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
      </div>
    </div>
  );
}
