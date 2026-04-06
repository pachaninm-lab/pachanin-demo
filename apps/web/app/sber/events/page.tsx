import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../lib/route-roles';

const events = [
  { id: 'DEMO', type: 'SAFE_DEAL_CALLBACK', status: 'RECEIVED', linkedDealId: 'DEAL-001', linkedPaymentId: 'PAY-001' },
  { id: 'EVT-002', type: 'STATEMENT_SYNC', status: 'RECONCILING', linkedDealId: 'DEAL-002', linkedPaymentId: 'PAY-002' },
];

export default function SberEventsPage() {
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Bank events ограничены" subtitle="Bank events доступны только money-ролям и operator/finance контуру.">
      <PageFrame title="Sber events" subtitle="Журнал callback / bank events и переход в linked money rails." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: 'Bank events' }]} />}>
        <SourceNote source="embedded bank event registry" warning="Bank events нужны не как лог. Из них должен быть прямой вход в payments, statements, documents и disputes, где реально меняется money truth." compact />

        <DetailHero
          kicker="Bank event registry"
          title="Callback и money events"
          description="Каждое банковое событие должно вести дальше в rail, где оно реально меняет состояние денег."
          chips={[`events ${events.length}`, 'callback', 'bank truth']}
          nextStep="Открыть event и проверить linked payment / statement / dispute path."
          owner="bank / finance / operator"
          blockers="bank events не должны жить отдельно от payments and reconciliation rails"
          actions={[
            { href: '/payments', label: 'Payments' },
            { href: '/sber/statements/DEMO', label: 'Statements', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">События</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {events.map((item) => (
              <Link key={item.id} href={`/sber/events/${item.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.type}</div>
                  <div className="muted small">{item.id} · deal {item.linkedDealId} · payment {item.linkedPaymentId}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из bank event registry пользователь должен уходить в rail, где callback реально влияет на деньги."
          items={[
            { href: '/payments', label: 'Payments', detail: 'Проверить release / hold / callback truth.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/sber/statements/DEMO', label: 'Statements', detail: 'Сверить bank truth и reconciliation path.', icon: '↗', meta: 'bank truth', tone: 'green' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal пакет для money movement.', icon: '⌁', meta: 'docs', tone: 'amber' },
            { href: '/disputes', label: 'Disputes', detail: 'Если event удерживает деньги, перейти в claim rail.', icon: '!', meta: 'hold', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть bank event и linked rail"
          detail="Следующий шаг — не читать лог, а открыть rail, где callback реально меняет money truth."
          primary={{ href: '/sber/events/DEMO', label: 'Открыть event' }}
          secondary={[{ href: '/payments', label: 'Payments' }, { href: '/sber/statements/DEMO', label: 'Statements' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
