import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { ModuleHub } from '../../../../components/module-hub';
import { NextStepBar } from '../../../../components/next-step-bar';
import { SourceNote } from '../../../../components/source-note';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';

const refundMap: Record<string, any> = {
  DEMO: {
    id: 'RF-001',
    status: 'ON_HOLD',
    amountRub: 420000,
    linkedDealId: 'DEAL-002',
    linkedPaymentId: 'PAY-002',
    reason: 'Спорная часть удержана до закрытия quality/dispute rail',
    nextAction: 'Открыть dispute и решить, что идёт в release, а что в refund',
    blockers: ['refund не должен жить отдельно от dispute rail', 'дальше нужен переход в payments / disputes / documents']
  }
};

export default function SberRefundDetailPage({ params }: { params: { id: string } }) {
  const refund = refundMap[params.id] || refundMap.DEMO;

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Refund rail ограничен" subtitle="Возвраты доступны только участникам money rail и operator/finance ролям.">
      <PageFrame title={`Refund ${refund.id}`} subtitle="Деталь возврата: amount, status, linked deal/payment and next action." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: refund.id }]} />}>
        <SourceNote source="embedded sber refund detail" warning="Refund rail нужен не как справка. Он должен вести в dispute, payments и documents, где реально принимается money decision." compact />

        <DetailHero
          kicker="Refund rail"
          title={`${refund.amountRub.toLocaleString('ru-RU')} ₽`}
          description={`${refund.status} · ${refund.reason}`}
          chips={[refund.status, refund.linkedDealId, refund.linkedPaymentId]}
          nextStep={refund.nextAction}
          owner="finance / operator / bank"
          blockers={refund.blockers.join(' · ')}
          actions={[
            { href: '/sber', label: 'Назад в Sber' },
            { href: '/disputes', label: 'Открыть dispute', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Параметры возврата</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Status</span><b>{refund.status}</b></div>
              <div className="list-row"><span>Amount</span><b>{refund.amountRub.toLocaleString('ru-RU')} ₽</b></div>
              <div className="list-row"><span>Deal</span><b>{refund.linkedDealId}</b></div>
              <div className="list-row"><span>Payment</span><b>{refund.linkedPaymentId}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Следующие rails</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="soft-box">Disputes — решить спорную часть money rail</div>
              <div className="soft-box">Payments — сверить hold / release / refund truth</div>
              <div className="soft-box">Documents — проверить, хватает ли legal пакета для возврата</div>
            </div>
          </div>
        </div>

        <ModuleHub
          title="Связанные rails"
          subtitle="После refund detail пользователь должен уходить в rail, где реально принимается решение по деньгам."
          items={[
            { href: '/disputes', label: 'Disputes', detail: 'Проверить claim и спорную часть money rail.', icon: '!', meta: 'claim', tone: 'amber' },
            { href: `/payments/${refund.linkedPaymentId}`, label: 'Payments', detail: 'Понять, что останется на hold, а что пойдёт в refund.', icon: '₽', meta: refund.linkedPaymentId, tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal / evidence readiness для refund.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: `/deals/${refund.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и execution continuation.', icon: '≣', meta: refund.linkedDealId, tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть rail, который решает refund"
          detail={refund.nextAction}
          primary={{ href: '/disputes', label: 'Открыть disputes' }}
          secondary={[{ href: `/payments/${refund.linkedPaymentId}`, label: 'Payments' }, { href: '/documents', label: 'Documents' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
