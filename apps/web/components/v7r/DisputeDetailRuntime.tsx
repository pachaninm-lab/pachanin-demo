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
import { PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE } from '@/lib/platform-v7/routes';

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
          <Link href={PLATFORM_V7_DISPUTES_ROUTE} style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
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
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>{dispute.reasonCode} · сделка <Link href={`${PLATFORM_V7_DEALS_ROUTE}/${dispute.dealId}`} style={{ color: 'var(--pc-accent)', fontWeight: 700 }}>{dispute.dealId}</Link></div>
          </div>
