'use client';

import { LabAnalysisForm } from './lab-analysis-form';

import { useMemo, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { useToast } from '../../../components/toast';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { AppShell } from '../../../components/app-shell';
import { LAB_ROLES } from '../../../lib/route-roles';
import { ModuleHub } from '../../../components/module-hub';
import { DealLifecycleLane } from '../../../components/deal-lifecycle-lane';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceOfTruthStrip } from '../../../components/source-of-truth-strip';
import { DeadlineProtectionPanel } from '../../../components/deadline-protection-panel';
import { buildDeadlineProtection } from '../../../../../packages/domain-core/src';

export default function LabDetailPage({ params }: { params: { id: string } }) {
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sampleState, setSampleState] = useState<'PENDING' | 'COMPLETED' | 'DISPUTED'>('PENDING');
  const [lastResult, setLastResult] = useState<{ protein: string; moisture: string; gluten: string; nature: string; contamination: string; note?: string } | null>(null);
  const deadline = useMemo(() => buildDeadlineProtection([{
    id: 'lab-deadline',
    title: 'Завершить лабораторный протокол',
    dueAt: new Date(Date.now() + (sampleState === 'PENDING' ? 55 : -35) * 60 * 1000).toISOString(),
    owner: 'lab',
    requiredNow: sampleState === 'PENDING' ? 'Завершить протокол качества' : 'Проверить результат',
  }]), [sampleState]);

  const baseMetrics = {
    protein: '12.3%',
    moisture: '11.7%',
    gluten: '25.1%',
    nature: '781 g/l',
    contamination: '0.9%',
  };

  const activeMetrics = lastResult
    ? {
        protein: `${lastResult.protein}%`,
        moisture: `${lastResult.moisture}%`,
        gluten: `${lastResult.gluten}%`,
        nature: `${lastResult.nature} g/l`,
        contamination: `${lastResult.contamination}%`,
      }
    : baseMetrics;

  const linkedDeal = {
    id: 'D-2026-0041',
    status: sampleState === 'PENDING' ? 'quality_check' : sampleState === 'COMPLETED' ? 'settlement_pending' : 'disputed',
    lifecycle: [
      { code: 'LOT_CONFIRMED', title: 'Лот подтверждён', status: 'DONE', href: '/lots' },
      { code: 'SHIPMENT_INBOUND', title: 'Рейс на приёмке', status: 'DONE', href: '/dispatch' },
      { code: 'QUALITY_CHECK', title: 'Лаборатория', status: sampleState === 'PENDING' ? 'ACTIVE' : sampleState === 'COMPLETED' ? 'DONE' : 'BLOCKED', href: `/lab/${params.id}` },
      { code: 'SETTLEMENT_READY', title: 'Расчёт денег', status: sampleState === 'COMPLETED' ? 'ACTIVE' : 'BLOCKED', href: '/settlement' },
      { code: 'PAYMENT_RELEASE', title: 'Выплата', status: sampleState === 'COMPLETED' ? 'PENDING' : 'BLOCKED', href: '/payments' },
    ] as Array<{ code: string; title: string; status: 'DONE' | 'ACTIVE' | 'PENDING' | 'BLOCKED'; href: string }>,
  };

  async function handleApprove() {
    setSubmitting(true);
    try {
      await api.post('/labs/complete');
      setSampleState('COMPLETED');
      show('success', 'Лабораторный протокол завершён. Сделка переведена в расчёт денег.');
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Не удалось завершить лабораторный протокол';
      show('error', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEscalate() {
    setSubmitting(true);
    try {
      await api.post('/labs/flag-quality-dispute');
      setSampleState('DISPUTED');
      show('success', 'Проба переведена в спор. Выплата и settlement заблокированы до решения.');
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Не удалось перевести пробу в спор';
      show('error', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageAccessGuard allowedRoles={[...LAB_ROLES]} title="Лаборатория ограничена" subtitle="Экран результатов доступен только лаборатории, оператору и приёмке.">
      <AppShell title={`Лабораторная проба ${params.id}`} subtitle={`Сделка ${linkedDeal.id} · контроль качества перед расчётом денег.`}>
        <div className="page-surface">
          <SourceOfTruthStrip
            entries={[
              { label: 'Истина', value: sampleState === 'COMPLETED' ? 'CANONICAL' : sampleState === 'DISPUTED' ? 'DISPUTE HOLD' : 'LIVE CHECK', tone: sampleState === 'COMPLETED' ? 'green' : sampleState === 'DISPUTED' ? 'red' : 'amber' },
              { label: 'Следующий rail', value: sampleState === 'COMPLETED' ? 'Settlement' : sampleState === 'DISPUTED' ? 'Dispute' : 'Lab finalize', tone: 'gray' },
              { label: 'Evidence', value: sampleState === 'COMPLETED' ? 'Protocol fixed' : 'Awaiting final protocol', tone: 'gray' },
            ]}
          />

          <DealLifecycleLane
            title="Контур сделки"
            steps={linkedDeal.lifecycle.map((item) => ({ key: item.code, title: item.title, href: item.href, detail: item.title, state: item.status }))}
          />

          <div className="dashboard-grid-4" style={{ marginTop: 24 }}>
            <div className="dashboard-card"><div className="dashboard-card-title">Protein</div><div className="dashboard-card-value">{activeMetrics.protein}</div><div className="dashboard-card-caption">Партия #{params.id}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Moisture</div><div className="dashboard-card-value">{activeMetrics.moisture}</div><div className="dashboard-card-caption">Влага</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Gluten</div><div className="dashboard-card-value">{activeMetrics.gluten}</div><div className="dashboard-card-caption">Клейковина</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Nature</div><div className="dashboard-card-value">{activeMetrics.nature}</div><div className="dashboard-card-caption">Натура</div></div>
          </div>

          <LabAnalysisForm
            dealId={linkedDeal.id}
            sampleId={params.id}
            initialValues={lastResult ?? {
              protein: baseMetrics.protein.replace('%', ''),
              moisture: baseMetrics.moisture.replace('%', ''),
              gluten: baseMetrics.gluten.replace('%', ''),
              nature: baseMetrics.nature.replace(' g/l', ''),
              contamination: baseMetrics.contamination.replace('%', ''),
            }}
            submitting={submitting}
            onSubmit={async (values) => {
              setSubmitting(true);
              try {
                await api.post('/labs/results', { sampleId: params.id, dealId: linkedDeal.id, ...values });
                setLastResult(values as any);
                setSampleState('COMPLETED');
                show('success', 'Результаты сохранены. Сделка теперь готова к settlement.');
              } catch (cause) {
                const message = cause instanceof ApiError ? cause.message : 'Не удалось сохранить лабораторный протокол';
                show('error', message);
              } finally {
                setSubmitting(false);
              }
            }}
          />

          <ModuleHub
            title="Что должно открываться после лаборатории"
            subtitle="После пробы пользователь не должен гадать, куда идти дальше: settlement, payment, dispute и документы должны быть рядом."
            items={[
              { href: '/settlement', label: 'Settlement', detail: 'Посмотреть, как результаты влияют на формулу денег.', icon: '₽', meta: sampleState === 'COMPLETED' ? 'ready' : 'blocked', tone: sampleState === 'COMPLETED' ? 'green' : 'gray' },
              { href: '/payments', label: 'Payments', detail: 'Убедиться, что payout не уйдёт раньше финального quality truth.', icon: '∎', meta: sampleState === 'COMPLETED' ? 'release next' : 'hold', tone: sampleState === 'COMPLETED' ? 'blue' : 'red' },
              { href: '/disputes', label: 'Disputes', detail: 'Перевести пробу в спор, если качество оспаривается.', icon: '⚠', meta: sampleState === 'DISPUTED' ? 'active' : 'ready', tone: sampleState === 'DISPUTED' ? 'red' : 'amber' },
              { href: '/documents', label: 'Documents', detail: 'Закрепить итоговый протокол в документовом контуре сделки.', icon: '⌁', meta: 'protocol', tone: 'gray' },
            ]}
          />

          <DeadlineProtectionPanel items={deadline.rows.map((row) => ({ id: row.id, title: row.title, deadline: row.dueAt ? new Date(row.dueAt).toLocaleString('ru-RU') : '—', status: row.state, detail: row.requiredNow }))} />

          <div className="section-card-tight" style={{ marginTop: 24 }}>
            <div className="section-title">Управление пробой</div>
            <div className="cta-stack" style={{ marginTop: 16 }}>
              <button onClick={handleApprove} disabled={submitting || sampleState === 'COMPLETED'} className="primary-link">Завершить лабораторию и открыть settlement</button>
              <button onClick={handleEscalate} disabled={submitting || sampleState === 'DISPUTED'} className="secondary-link">Перевести в dispute rail</button>
            </div>
          </div>

          <NextStepBar
            title={sampleState === 'COMPLETED' ? 'Открыть settlement и проверить формулу денег' : sampleState === 'DISPUTED' ? 'Открыть dispute rail' : 'Завершить лабораторный протокол'}
            detail={sampleState === 'COMPLETED' ? 'Результат уже финален и должен идти дальше в деньги.' : sampleState === 'DISPUTED' ? 'Спор заблокировал payout до решения.' : 'Пока проба не закрыта, settlement и payout должны оставаться заблокированными.'}
            primary={{ href: sampleState === 'DISPUTED' ? '/disputes' : '/settlement', label: sampleState === 'DISPUTED' ? 'Открыть dispute rail' : 'Открыть settlement' }}
            secondary={[{ href: '/payments', label: 'Payments' }, { href: '/documents', label: 'Documents' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
