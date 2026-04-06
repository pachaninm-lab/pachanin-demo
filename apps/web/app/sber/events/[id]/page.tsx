import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { ModuleHub } from '../../../../components/module-hub';
import { NextStepBar } from '../../../../components/next-step-bar';
import { SourceNote } from '../../../../components/source-note';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';

const eventMap: Record<string, any> = {
  DEMO: {
    id: 'EVT-001',
    type: 'SAFE_DEAL_CALLBACK',
    status: 'RECEIVED',
    linkedDealId: 'DEAL-001',
    linkedPaymentId: 'PAY-001',
    timestamp: '2026-04-03 12:45',
    nextAction: 'Сверить bank truth и подтвердить release/hold decision',
    blockers: ['callback не должен жить отдельно от money rail', 'дальше нужен переход в payments / documents / disputes']
  }
};

export default function SberEventDetailPage({ params }: { params: { id: string } }) {
  const event = eventMap[params.id] || eventMap.DEMO;

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Bank event ограничен" subtitle="Bank events доступны только участникам money rail и operator/finance ролям.">
      <PageFrame title={`Bank event ${event.id}`} subtitle="Деталь callback / bank event: type, status, linked deal/payment and next action." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: event.id }]} />}>
        <SourceNote source="embedded sber event detail" warning="Bank event нужен не как лог callback. Он должен вести в payments, documents и disputes, где реально меняется money truth." compact />

        <DetailHero
          kicker="Bank event"
          title={event.type}
          description={`${event.status} · ${event.timestamp}`}
          chips={[event.status, event.linkedDealId, event.linkedPaymentId]}
          nextStep={event.nextAction}
          owner="bank / finance / operator"
          blockers={event.blockers.join(' · ')}
          actions={[
            { href: '/sber', label: 'Назад в Sber' },
            { href: `/payments/${event.linkedPaymentId}`, label: 'Открыть платёж', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры события</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Type</span><b>{event.type}</b></div>
              <div className="list-row"><span>Status</span><b>{event.status}</b></div>
              <div className="list-row"><span>Deal</span><b>{event.linkedDealId}</b></div>
              <div className="list-row"><span>Payment</span><b>{event.linkedPaymentId}</b></div>
              <div className="list-row"><span>At</span><b>{event.timestamp}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Payments — release / hold / callback reconciliation</div>
              <div className="soft-box">Documents — проверить legal readiness перед выпуском денег</div>
              <div className="soft-box">Disputes — если callback конфликтный, перейти в claim rail</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После bank event пользователь должен уходить в rail, где этот callback реально меняет состояние."
          items={[
            { href: `/payments/${event.linkedPaymentId}`, label: 'Payments', detail: 'Проверить release / hold и money truth.', icon: '₽', meta: event.linkedPaymentId, tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Понять, хватает ли документного пакета для банка.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/disputes', label: 'Disputes', detail: 'Если callback удерживает деньги, перейти в спорный rail.', icon: '!', meta: 'hold', tone: 'amber' },
            { href: `/deals/${event.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: event.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, который меняет callback"
          detail={event.nextAction}
          primary={{ href: `/payments/${event.linkedPaymentId}`, label: 'Открыть payments' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/disputes', label: 'Disputes' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
