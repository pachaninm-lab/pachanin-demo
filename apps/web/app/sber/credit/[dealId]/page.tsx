import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';
import { SourceNote } from '../../../../components/source-note';
import { getDealWorkspaceCanonical } from '../../../../lib/deals-server';

export default async function SberCreditDealPage({ params, searchParams }: { params: { dealId: string }, searchParams?: Record<string, string | string[] | undefined> }) {
  const workspaceResponse = await getDealWorkspaceCanonical(params.dealId);
  const workspace = workspaceResponse.data || {};
  const deal = workspace.deal || null;
  const sber = workspace.payment?.sber || null;
  const insurance = workspace.insurance || null;
  const appliedProgram = typeof searchParams?.program === 'string' ? searchParams.program : 'invoice-financing';

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Кредитный сценарий ограничен" subtitle="Карточка кредитного сценария нужна банковым и money-control ролям.">
      <PageFrame title={`Сбер · кредит под сделку ${params.dealId}`} subtitle="Детальная карточка сценария кредитования: база, collateral, release path и связанные риски." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { href: `/deals/${params.dealId}`, label: params.dealId }, { label: 'Кредит' }]} />}>
        <SourceNote source="deal workspace / canonical projection" warning="Это не маркетинговое описание продукта, а рабочая карточка связанного кредитного сценария внутри сделки." compact />

        <DetailHero
          kicker="Sber credit scenario"
          title={deal?.title || `Сделка ${params.dealId}`}
          description={`Программа: ${appliedProgram}. Смотрим release path, сумму, документы и привязку к сделке без перехода в сторонние контуры.`}
          chips={[
            sber?.loanEligible ? 'loan eligible' : 'review',
            sber?.escrowMode || 'safe-deal',
            insurance ? 'insured rail linked' : 'insurance optional',
            deal?.status || 'deal'
          ]}
          nextStep={sber?.loanEligible ? 'Подготовить пакет к банковому решению и проверить release gates.' : 'Сначала убрать blockers по docs, trust и money readiness.'}
          owner="bank rail / money control"
          blockers={sber?.blockers?.join(' · ') || 'критичных банковых blockers не отмечено'}
          actions={[
            { href: `/deals/${params.dealId}`, label: 'К сделке' },
            { href: `/sber?safeDeal=${params.dealId}`, label: 'Назад в safe deal', variant: 'secondary' },
            { href: '/finance', label: 'Финансы', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Что смотрит банк</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Сделка</span><b>{deal?.id || params.dealId}</b></div>
              <div className="list-row"><span>Покупатель</span><b>{deal?.buyerId || 'buyer-linked'}</b></div>
              <div className="list-row"><span>Сумма</span><b>{deal?.settlement?.finalAmountRub?.toLocaleString?.('ru-RU') || 'по waterfall'}</b></div>
              <div className="list-row"><span>Escrow / safe deal</span><b>{sber?.escrowMode || 'SAFE_DEAL'}</b></div>
              <div className="list-row"><span>Документы</span><b>{sber?.docsStatus || 'collecting'}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Что двигает решение</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {(sber?.decisionSignals || ['payment discipline', 'document completeness', 'shipment proof']).map((item: string) => <span key={item} className="mini-chip">{item}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>
              Если insurance rail уже связан со сделкой, банк получает более чистую картину по рискам груза и release path.
            </div>
          </div>
        </div>

        <section className="section-card-tight">
          <div className="section-title">Следующие rails</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/documents" className="primary-link">Проверить пакет документов</Link>
            <Link href="/payments" className="secondary-link">Проверить money release</Link>
            <Link href={insurance ? `/insurance?dealId=${params.dealId}` : '/insurance'} className="secondary-link">Страхование</Link>
          </div>
        </section>
      </PageFrame>
    </PageAccessGuard>
  );
}
