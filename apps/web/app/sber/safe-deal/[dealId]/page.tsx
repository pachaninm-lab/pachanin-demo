import Link from 'next/link';
import { PageFrame } from '../../../../components/page-frame';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { DetailHero } from '../../../../components/detail-hero';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../../lib/route-roles';
import { SourceNote } from '../../../../components/source-note';
import { getDealWorkspaceCanonical } from '../../../../lib/deals-server';

export default async function SberSafeDealPage({ params }: { params: { dealId: string } }) {
  const workspaceResponse = await getDealWorkspaceCanonical(params.dealId);
  const workspace = workspaceResponse.data || {};
  const payment = workspace.payment || null;
  const timeline = payment?.safeDealTimeline || [];

  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Safe deal rail ограничен" subtitle="Экран безопасной сделки нужен банковым и operator-ролям.">
      <PageFrame title={`Сбер · safe deal ${params.dealId}`} subtitle="Детальная карточка защищённого release path по сделке." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { href: `/deals/${params.dealId}`, label: params.dealId }, { label: 'Safe deal' }]} />}>
        <SourceNote source="deal workspace / payment safe-deal projection" warning="Safe deal — это не маркетинговая витрина. Она должна объяснять, где деньги, что их держит и какой owner action нужен прямо сейчас." compact />
        <DetailHero
          kicker="Safe deal"
          title={`Release rail по ${params.dealId}`}
          description={`Escrow mode: ${payment?.escrowMode || 'SAFE_DEAL'}. В карточке собран payment state, release path и bank blockers.`}
          chips={[payment?.status || 'money rail', payment?.escrowMode || 'safe deal', payment?.bankConfirmationStatus || 'bank pending']}
          nextStep={payment?.status === 'payment_initiated' ? 'Проверить bank confirmation и statement callback.' : 'Открыть верхний blocker и двигать release path дальше.'}
          owner="bank rail"
          blockers={payment?.blockers?.join(' · ') || 'критичных blockers по safe deal не видно'}
          actions={[
            { href: `/payments/${payment?.id || ''}`, label: 'К payment rail' },
            { href: '/payments', label: 'Платежи', variant: 'secondary' },
            { href: `/sber/credit/${params.dealId}`, label: 'Кредит', variant: 'secondary' }
          ]}
        />
        <section className="section-card-tight">
          <div className="section-title">Safe deal timeline</div>
          <div className="section-stack" style={{ marginTop: 12 }}>
            {timeline.length ? timeline.map((item: any) => (
              <div key={item.id} className="list-row">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted small">{item.at} · {item.detail}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </div>
            )) : <div className="muted small">Timeline safe deal пока пуст.</div>}
          </div>
        </section>
      </PageFrame>
    </PageAccessGuard>
  );
}
