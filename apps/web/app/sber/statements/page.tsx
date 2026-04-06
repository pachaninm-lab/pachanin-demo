import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../lib/route-roles';

const statements = [
  { id: 'DEMO', accountType: 'nominal account', status: 'RECONCILING', period: '2026-04-03', linkedDealId: 'DEAL-001', linkedPaymentId: 'PAY-001' },
  { id: 'STM-002', accountType: 'safe deal ledger', status: 'READY', period: '2026-04-02', linkedDealId: 'DEAL-002', linkedPaymentId: 'PAY-002' },
];

export default function SberStatementsPage() {
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Statements registry ограничен" subtitle="Statements доступны только money-ролям и operator/finance контуру.">
      <PageFrame title="Sber statements" subtitle="Реестр bank truth, statement lines and reconciliation continuation." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: 'Statements' }]} />}>
        <SourceNote source="embedded statement registry" warning="Statement rail нужен не как PDF-выписка. Из него должен быть прямой вход в payments, events, documents и reconciliation path." compact />

        <DetailHero
          kicker="Statement registry"
          title="Bank truth и reconciliation"
          description="Каждая выписка должна вести дальше в rail, где реально сверяется payment truth и callback history."
          chips={[`statements ${statements.length}`, 'bank truth', 'reconciliation']}
          nextStep="Открыть statement и проверить linked payment / event / document continuation."
          owner="finance / bank / operator"
          blockers="statement registry не должен жить отдельно от payments and callback rails"
          actions={[
            { href: '/payments', label: 'Payments' },
            { href: '/sber/events/DEMO', label: 'Bank events', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Statements</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {statements.map((item) => (
              <Link key={item.id} href={`/sber/statements/${item.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.accountType}</div>
                  <div className="muted small">{item.id} · {item.period} · deal {item.linkedDealId}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из statement registry пользователь должен уходить в reconciliation rail, а не оставаться в bank truth list."
          items={[
            { href: '/payments', label: 'Payments', detail: 'Проверить release / hold / callback truth.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Проверить callback sequence и order of events.', icon: '↗', meta: 'events', tone: 'green' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal пакет для money movement.', icon: '⌁', meta: 'docs', tone: 'amber' },
            { href: '/disputes', label: 'Disputes', detail: 'Если reconciliation упёрся в hold, перейти в claim rail.', icon: '!', meta: 'hold', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть statement и linked rail"
          detail="Следующий шаг — не смотреть на список выписок, а открыть rail, где сверяется bank truth."
          primary={{ href: '/sber/statements/DEMO', label: 'Открыть statement' }}
          secondary={[{ href: '/payments', label: 'Payments' }, { href: '/sber/events/DEMO', label: 'Bank events' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
