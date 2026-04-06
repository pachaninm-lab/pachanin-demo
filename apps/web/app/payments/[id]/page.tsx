import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PaymentRailConsole } from '../../../components/payment-rail-console';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { FINANCE_ROLES } from '../../../lib/route-roles';
import { buildPaymentDetailView } from '../../../lib/commercial-workspace-store';

export default async function PaymentDetailPage({ params }: { params: { id: string } }) {
  const view = await buildPaymentDetailView(params.id);
  const payment = view.payment;

  if (!payment) {
    return (
      <PageFrame title="Платёж не найден" subtitle="Карточка платежа отсутствует в текущем рабочем контуре.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в платежный реестр и открой актуальный платёж.</div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...FINANCE_ROLES]} title="Карточка платежа ограничена" subtitle="Карточка payment нужна финансовым и operator-ролям.">
      <PageFrame title={payment.id} subtitle={`${payment.directionLabel} · ${payment.amountRub.toLocaleString('ru-RU')} ₽`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/payments', label: 'Платежи' }, { label: payment.id }]} />}>
        <SourceNote source="commercial workspace / payment detail view" warning="Карточка payment — это рабочий money rail. Здесь должен быть не просто статус, а release path и next owner action." compact />

        <DetailHero
          kicker="Payment rail"
          title={payment.counterpartyName}
          description={`${payment.directionLabel} · ${payment.amountRub.toLocaleString('ru-RU')} ₽. Показываем release gate, beneficiary, claim impact и документы, которые двигают деньги.`}
          chips={[payment.status, payment.disbursementMode, payment.bankName, payment.releaseGate]}
          nextStep={payment.nextAction}
          owner={payment.owner}
          blockers={payment.blockers.join(' · ')}
          actions={[
            payment.linkedDealId ? { href: `/deals/${payment.linkedDealId}`, label: 'Открыть сделку' } : { href: '/payments', label: 'К реестру' },
            { href: '/documents', label: 'Документы', variant: 'secondary' },
            { href: '/disputes', label: 'Споры', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Release context</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Release gate</span><b>{payment.releaseGate}</b></div>
              <div className="list-row"><span>Bank</span><b>{payment.bankName}</b></div>
              <div className="list-row"><span>Beneficiary</span><b>{payment.beneficiaryName}</b></div>
              <div className="list-row"><span>Escrow / mode</span><b>{payment.disbursementMode}</b></div>
              <div className="list-row"><span>Linked deal</span><b>{payment.linkedDealId || '—'}</b></div>
            </div>
          </div>
          <PaymentRailConsole payment={payment as any} waterfall={view.waterfall as any} documents={view.documents as any} disputes={view.disputes as any} />
        </div>

        <ModuleHub
          title="Связанные rails по платежу"
          subtitle="Платёж не должен быть тупиковой карточкой. Он обязан вести в документы, dispute rail и сделочный контур."
          items={[
            payment.linkedDealId ? { href: `/deals/${payment.linkedDealId}`, label: 'Deal rail', detail: 'Сверить blockers и owner action сделки перед релизом.', icon: '≣', meta: payment.linkedDealId, tone: 'blue' } : { href: '/deals', label: 'Deals', detail: 'Открыть сделочный контур.', icon: '≣', meta: 'open', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal readiness и completeness пакета.', icon: '⌁', meta: `${view.documents.length} docs`, tone: 'green' },
            { href: '/disputes', label: 'Disputes', detail: 'Если есть claim / hold, money rail должен идти туда.', icon: '⚠️', meta: `${view.disputes.length} disputes`, tone: view.disputes.length ? 'red' : 'gray' },
            { href: '/sber', label: 'Bank rail', detail: 'Открыть связанный bank / safe-deal / statement rail.', icon: '₽', meta: payment.bankName, tone: 'amber' },
          ]}
        />

        <NextStepBar
          title={payment.nextAction}
          detail={payment.blockers.join(' · ') || 'Критичных blockers не видно.'}
          primary={{ href: payment.linkedDealId ? `/deals/${payment.linkedDealId}` : '/payments', label: payment.linkedDealId ? 'Открыть сделку' : 'К реестру' }}
          secondary={[{ href: '/documents', label: 'Документы' }, { href: '/disputes', label: 'Споры' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
