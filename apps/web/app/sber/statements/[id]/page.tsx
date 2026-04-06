import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { ModuleHub } from '../../../../components/module-hub';
import { NextStepBar } from '../../../../components/next-step-bar';
import { SourceNote } from '../../../../components/source-note';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';

const statementMap: Record<string, any> = {
  DEMO: {
    id: 'STM-001',
    accountType: 'nominal account',
    status: 'RECONCILING',
    period: '2026-04-03',
    linkedDealId: 'DEAL-001',
    linkedPaymentId: 'PAY-001',
    nextAction: 'Сверить statement lines с payment truth и callback history',
    blockers: ['statement не должен жить отдельно от payments rail', 'дальше нужен переход в payments / events / documents']
  }
};

export default function SberStatementDetailPage({ params }: { params: { id: string } }) {
  const statement = statementMap[params.id] || statementMap.DEMO;

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Bank truth ограничен" subtitle="Statements доступны только money-ролям и operator/finance контуру.">
      <PageFrame title={`Statement ${statement.id}`} subtitle="Деталь bank truth: account, period, linked deal/payment and reconciliation path." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: statement.id }]} />}>
        <SourceNote source="embedded sber statement detail" warning="Statement rail нужен не как PDF-выписка. Он должен вести в reconciliation по payments, events и documents."
 compact />

        <DetailHero
          kicker="Bank truth"
          title={statement.accountType}
          description={`${statement.status} · period ${statement.period}`}
          chips={[statement.status, statement.linkedDealId, statement.linkedPaymentId]}
          nextStep={statement.nextAction}
          owner="finance / bank / operator"
          blockers={statement.blockers.join(' · ')}
          actions={[
            { href: '/sber', label: 'Назад в Sber' },
            { href: `/payments/${statement.linkedPaymentId}`, label: 'Открыть payment', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры выписки</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Account</span><b>{statement.accountType}</b></div>
              <div className="list-row"><span>Status</span><b>{statement.status}</b></div>
              <div className="list-row"><span>Period</span><b>{statement.period}</b></div>
              <div className="list-row"><span>Deal</span><b>{statement.linkedDealId}</b></div>
              <div className="list-row"><span>Payment</span><b>{statement.linkedPaymentId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Payments — сверить amount / hold / release truth</div>
              <div className="soft-box">Bank events — проверить callback sequence и timestamps</div>
              <div className="soft-box">Documents — подтвердить legal basis для money movement</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После просмотра statement пользователь должен уходить в reconciliation rail, а не оставаться в bank truth card."
          items={[
            { href: `/payments/${statement.linkedPaymentId}`, label: 'Payments', detail: 'Проверить совпадение release / hold / callback truth.', icon: '₽', meta: statement.linkedPaymentId, tone: 'blue' },
            { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Проверить callback sequence и order of events.', icon: '↗', meta: 'events', tone: 'green' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal пакет для money movement.', icon: '⌁', meta: 'docs', tone: 'amber' },
            { href: `/deals/${statement.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и finance continuation.', icon: '≣', meta: statement.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, где сверяется bank truth"
          detail={statement.nextAction}
          primary={{ href: `/payments/${statement.linkedPaymentId}`, label: 'Открыть payments' }}
          secondary={[{ href: '/sber/events/DEMO', label: 'Bank events' }, { href: '/documents', label: 'Documents' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
