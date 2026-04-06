import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../lib/route-roles';

const refunds = [
  { id: 'DEMO', status: 'ON_HOLD', amountRub: 420000, linkedDealId: 'DEAL-002', linkedPaymentId: 'PAY-002' },
  { id: 'RF-002', status: 'REVIEW', amountRub: 180000, linkedDealId: 'DEAL-001', linkedPaymentId: 'PAY-003' },
];

export default function SberRefundsPage() {
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Refund registry ограничен" subtitle="Возвраты доступны только money-ролям и operator/finance контуру.">
      <PageFrame title="Sber refunds" subtitle="Реестр refund cases и переход в linked dispute / payment / document rails." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: 'Refunds' }]} />}>
        <SourceNote source="embedded refund registry" warning="Refund rail нужен не как список сумм. Из него должен быть прямой вход в disputes, payments и documents, где реально принимается money decision." compact />

        <DetailHero
          kicker="Refund registry"
          title="Возвраты и спорная часть денег"
          description="Каждый refund case должен вести дальше в rail, где реально решается спорная часть money flow."
          chips={[`refunds ${refunds.length}`, 'refund rail', 'money dispute']}
          nextStep="Открыть refund case и проверить linked dispute / payment continuation."
          owner="finance / operator / bank"
          blockers="refund registry не должен жить отдельно от disputes and payments rails"
          actions={[
            { href: '/disputes', label: 'Disputes' },
            { href: '/payments', label: 'Payments', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Refund cases</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {refunds.map((item) => (
              <Link key={item.id} href={`/sber/refunds/${item.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.amountRub.toLocaleString('ru-RU')} ₽</div>
                  <div className="muted small">{item.id} · deal {item.linkedDealId} · payment {item.linkedPaymentId}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из refund registry пользователь должен уходить туда, где реально решается refund decision."
          items={[
            { href: '/disputes', label: 'Disputes', detail: 'Проверить claim и спорную часть money rail.', icon: '!', meta: 'claim', tone: 'amber' },
            { href: '/payments', label: 'Payments', detail: 'Сверить hold / release / refund truth.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal / evidence readiness для refund.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Проверить callback sequence по refund path.', icon: '↗', meta: 'events', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть refund case и linked rail"
          detail="Следующий шаг — не смотреть на сумму, а открыть rail, где решается refund truth."
          primary={{ href: '/sber/refunds/DEMO', label: 'Открыть refund' }}
          secondary={[{ href: '/disputes', label: 'Disputes' }, { href: '/payments', label: 'Payments' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
