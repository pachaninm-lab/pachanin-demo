'use client';

import * as React from 'react';
import Link from 'next/link';
import { P7ActionLog } from '@/components/platform-v7/P7ActionLog';
import { createActionLogEntry, type PlatformActionLogEntry } from '@/lib/platform-v7/action-log';
import { selectDisputeById } from '@/lib/domain/selectors';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';
import { buildEvidencePackReadinessUiModel, type P7EvidenceUiTone } from '@/lib/v7r/evidence-pack-ui';
import { platformV7DisputeCloseCheck, type PlatformV7DisputeCloseBlocker } from '@/lib/platform-v7/dispute-close-check';
import { PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE } from '@/lib/platform-v7/routes';

const closeReasonLabels: Record<PlatformV7DisputeCloseBlocker, string> = {
  EVIDENCE_PACK_NOT_READY: 'пакет доказательств не готов',
  MISSING_DECISION: 'не указано решение',
  MISSING_REASON: 'не указано основание',
  MONEY_EFFECT_NOT_SET: 'не указано влияние на деньги',
  NEGATIVE_MONEY_EFFECT: 'сумма влияния не может быть отрицательной',
};

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

function Badge({ tone, children }: { tone: P7EvidenceUiTone; children: React.ReactNode }) {
  const p = tonePalette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 12, fontWeight: 800 }}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{value}</div>
    </div>
  );
}

function formatCloseReasons(reasons: readonly PlatformV7DisputeCloseBlocker[]) {
  return reasons.length ? reasons.map((reason) => closeReasonLabels[reason]).join(', ') : '—';
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
      `Статус пакета: ${evidenceUi.statusLabel}`,
      `Готовность: ${evidenceUi.scoreLabel}`,
      `Обязательные доказательства: ${evidenceUi.requiredLabel}`,
      `Удержано: ${formatMoney(dispute.holdAmount)}`,
      `Срок: ${dispute.slaDaysLeft} дн.`,
      '',
      'Ограничения:',
      ...evidenceUi.limitations.map((item) => `— ${item}`),
      '',
      'Причины остановки:',
      ...(evidenceUi.blockers.length ? evidenceUi.blockers.map((item) => `— ${item}`) : ['— нет']),
      '',
      'Доказательства:',
      ...(evidenceUi.items.length ? evidenceUi.items.map((item) => `— ${item.id}: ${item.title}`) : ['— нет доказательств']),
      '',
      `Сформировано: ${new Date().toISOString()}`,
    ].join('\n');

    downloadTextFile(`dispute-evidence-${dispute.id}.txt`, content);
    const logEntry = createActionLogEntry({
      scope: 'dispute',
      status: 'success',
      objectId: dispute.id,
      action: 'скачан-пакет-доказательств',
      actor: 'оператор',
      message: `Пакет доказательств скачан: ${evidenceUi.scoreLabel}, ${evidenceUi.totalLabel}.`,
    });
    setSnapshotLog((current) => [logEntry, ...current].slice(0, 4));
    trackEvent('dispute_package_downloaded', { disputeId, evidenceObjects: evidenceUi.items.length, readiness: evidenceUi.scoreLabel });
    toast(`Пакет доказательств ${evidenceUi.scoreLabel} скачан`, 'success');
  }

  if (!dispute) {
    return (
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Спор {disputeId}</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 8 }}>Данные по спору не найдены.</div>
        <Link href={PLATFORM_V7_DISPUTES_ROUTE} style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
      </section>
    );
  }

  const closeCheck = platformV7DisputeCloseCheck({
    evidencePack: {
      canSubmit: evidenceUi.statusTone === 'success',
      status: evidenceUi.statusTone === 'success' ? 'complete' : 'incomplete',
      blockers: evidenceUi.blockers,
    },
    decision: evidenceUi.statusTone === 'success' ? 'Решение подготовлено по пакету доказательств' : '',
    reason: dispute.description,
    moneyEffectRub: dispute.holdAmount,
  });

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 920, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>{dispute.id}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{dispute.title}</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>{dispute.reasonCode} · сделка <Link href={`${PLATFORM_V7_DEALS_ROUTE}/${dispute.dealId}`} style={{ color: 'var(--pc-accent)', fontWeight: 700 }}>{dispute.dealId}</Link></div>
          </div>
          <Badge tone={dispute.status === 'open' ? 'danger' : 'success'}>{dispute.status === 'open' ? 'Открыт' : 'Закрыт'}</Badge>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <Metric label='Удержано' value={formatMoney(dispute.holdAmount)} />
        <Metric label='Срок' value={`${dispute.slaDaysLeft} дн.`} />
        <Metric label='Готовность доказательств' value={evidenceUi.scoreLabel} />
        <Metric label='Ответственный' value={dispute.ballAt} />
      </div>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Проверка закрытия спора</div>
        <Badge tone={closeCheck.canClose ? 'success' : 'danger'}>{closeCheck.canClose ? 'Можно готовить решение' : 'Закрытие остановлено'}</Badge>
        <Metric label='Причины остановки' value={formatCloseReasons(closeCheck.blockers)} />
        <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.7 }}>{dispute.description}</div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Пакет доказательств</div>
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>Объектный пакет для пилотного контура. Живая загрузка файлов, КЭП и боевой архив требуют внешних подключений.</div>
          </div>
          <Badge tone={evidenceUi.statusTone}>{evidenceUi.statusLabel}</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Metric label='Готовность' value={evidenceUi.scoreLabel} />
          <Metric label='Обязательные' value={evidenceUi.requiredLabel} />
          <Metric label='Всего' value={evidenceUi.totalLabel} />
        </div>

        {evidenceUi.blockers.length > 0 && (
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.16)', display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Причины остановки</div>
            {evidenceUi.blockers.map((item) => <div key={item} style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>— {item}</div>)}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {evidenceUi.items.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', fontSize: 13, color: 'var(--pc-text-muted)' }}>Для этого спора нет закреплённых доказательств.</div>
          ) : evidenceUi.items.map((item) => (
            <article key={item.id} style={{ padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.id}</div>
                </div>
                <Badge tone={item.issueLabels.length ? 'danger' : 'success'}>{item.issueLabels.length ? 'есть замечания' : 'принято'}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <Metric label='Тип' value={item.typeLabel} />
                <Metric label='Источник' value={item.sourceLabel} />
                <Metric label='Проверка' value={item.trustLabel} />
                <Metric label='Участник' value={item.actorLabel} />
                <Metric label='Геометка' value={item.geoLabel} />
                <Metric label='Целостность' value='зафиксировано' />
              </div>
              <div style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>дата события: {item.capturedAtLabel} · загружено: {item.uploadedAtLabel} · подпись: {item.signatureLabel}</div>
            </article>
          ))}
        </div>

        <button onClick={handlePackageDownload} style={{ justifySelf: 'start', padding: '10px 16px', borderRadius: 12, border: 'none', background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Скачать пакет доказательств</button>
        <P7ActionLog title='Журнал скачивания доказательств' entries={snapshotLog} emptyLabel='Пакет ещё не скачивали.' maxEntries={4} />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleReminder} disabled={reminderSent} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.08)', color: reminderSent ? '#9CA3AF' : '#2563EB', fontSize: 13, fontWeight: 800, cursor: reminderSent ? 'default' : 'pointer' }}>
          {reminderSent ? 'Напоминание отправлено ✓' : 'Отправить напоминание'}
        </button>
        <Link href={PLATFORM_V7_DISPUTES_ROUTE} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Все споры</Link>
      </div>
    </div>
  );
}
