import { SettlementActions } from './settlement-actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { ModuleHub } from '../../../components/module-hub';
import { RuntimeSourceBanner } from '../../../components/runtime-source-banner';
import { getRuntimeSnapshot } from '../../../lib/runtime-server';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';

export default async function SettlementDetailPage({ params }: { params: { id: string } }) {
  const snapshot = await getRuntimeSnapshot();
  const payment = snapshot.payments.find((item) => item.id === params.id);
  if (!payment) notFound();

  const deal = snapshot.deals.find((item) => item.id === payment.dealId);
  const docs = snapshot.documents.filter((item) => item.dealId === payment.dealId || item.linkedDealId === payment.dealId).slice(0, 3);
  const dispute = snapshot.disputes.find((item) => item.dealId === payment.dealId);
  const lab = snapshot.labSamples.find((item) => item.dealId === payment.dealId);
  const inventory = snapshot.inventoryLots.find((item) => item.dealId === payment.dealId || item.sourceDealId === payment.dealId);

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Settlement case доступен только рабочим ролям" subtitle="Из этого alias-экрана должны быть доступны ledger, документы, качество, титул и спор, если он блокирует release.">
      <AppShell title={`Settlement · ${payment.id}`} subtitle={payment.status} actions={<Link href={`/payments/${payment.id}`} className="primary-link">Открыть канонический платёж</Link>}>
        <RuntimeSourceBanner snapshot={snapshot} />

        <section className="detail-header">
          <div>
            <div className="detail-title">{payment.dealId}</div>
            <div className="detail-meta">
              <span className="mini-chip">{payment.status}</span>
              <span className="mini-chip">{Number(payment.amount).toLocaleString('ru-RU')} ₽</span>
              {deal ? <span className="mini-chip">{deal.culture} · {deal.volume} т</span> : null}
            </div>
          </div>
          <div className="cta-stack">
            <Link href="/documents" className="secondary-link">Документы</Link>
            <Link href="/lab" className="secondary-link">Качество</Link>
            <Link href="/inventory" className="secondary-link">Batch / титул</Link>
          </div>
        </section>

        <section className="dashboard-grid-3">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Выпуск денег</div>
            <div className="dashboard-card-value" style={{ fontSize: '1.7rem' }}>{payment.status}</div>
            <div className="dashboard-card-caption">{payment.reason || (payment as any).timeline?.[0]?.event || 'Статус ledger.'}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Документы</div>
            <div className="dashboard-card-value">{docs.length}</div>
            <div className="dashboard-card-caption">Должны быть green или с понятной причиной hold.</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Спор / качество</div>
            <div className="dashboard-card-value" style={{ fontSize: '1.7rem' }}>{dispute ? 'HOLD' : 'OK'}</div>
            <div className="dashboard-card-caption">{dispute ? dispute.status : lab ? `${lab.status} · ${lab.priceImpact} ₽/т` : 'Спор не открыт.'}</div>
          </div>
        </section>

        <ModuleHub
          title="Основания settlement"
          subtitle="Выплата должна быть объяснима переходами в конкретные подтверждающие модули."
          items={[
            { href: `/payments/${payment.id}`, label: 'Ledger / callbacks', detail: 'Канонический реестр и timeline банковских шагов.', icon: '₽', tone: 'green' },
            { href: docs[0] ? `/documents/${docs[0].id}` : '/documents', label: 'Документы', detail: docs[0] ? `${docs[0].type} · ${docs[0].status}` : 'Проверить обязательный пакет.', icon: '⌁', tone: 'amber' },
            { href: lab ? `/lab/${lab.id}` : '/lab', label: 'Лаборатория', detail: lab ? `${lab.status} · Δ ${lab.priceImpact} ₽/т` : 'Уточнить quality delta.', icon: '∴', tone: 'amber' },
            { href: inventory ? `/inventory/${inventory.id}` : '/inventory', label: 'Batch / титул', detail: inventory ? `${inventory.batch} · ${inventory.titleStatus}` : 'Проверить ownership и batch.', icon: '□', tone: 'blue' },
            { href: dispute ? `/disputes/${dispute.id}` : '/disputes', label: 'Спор', detail: dispute ? `${dispute.topic} · ${dispute.status}` : 'Спор не открыт.', icon: '!', tone: dispute ? 'red' : 'gray' }
          ]}
        />
      
      <SettlementActions id={params.id} />
    </AppShell>
    </PageAccessGuard>
  );
}
