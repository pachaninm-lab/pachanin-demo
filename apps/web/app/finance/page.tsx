import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { FINANCE_ROLES } from '../../lib/route-roles';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { FinanceConsole } from '../../components/finance-console';
import { buildFinanceView, readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function FinanceHubPage() {
  const state = await readCommercialWorkspace();
  const view = buildFinanceView(state);
  const active = view.applications.filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'LIMIT_REVIEW', 'APPROVED'].includes(item.status));
  const funded = view.applications.filter((item) => item.status === 'FUNDED');
  const draft = view.applications.filter((item) => item.status === 'DRAFT');
  const totalAmount = view.applications.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lead = active[0] || funded[0] || view.applications[0] || null;

  return (
    <PageAccessGuard allowedRoles={[...FINANCE_ROLES]} title="Финансовый контур доступен только финансовым ролям" subtitle="Здесь создают и двигают заявки на аванс, отсрочку, факторинг и кредит исполнения.">
      <AppShell title="Финансовый контур сделки" subtitle="Не просто ledger, а отдельный рабочий кабинет финансирования: заявка, лимит, решение, waterfall и связка со сделкой.">
        <SourceNote source="commercial workspace / persisted state" warning="Финконтур стал отдельным модулем: можно создавать заявки, двигать статусы и видеть payment waterfall по каждой заявке." compact />

        <DetailHero
          kicker="Finance center"
          title="Финансирование встроено внутрь сделки, а не живёт сбоку"
          description="Aванс, factor, buyer deferral и credit on execution должны продолжаться в документы, приёмку, оплату и репутацию контрагента."
          chips={[
            `заявок ${view.applications.length}`,
            `в работе ${active.length}`,
            `funded ${funded.length}`,
            `лимит ${totalAmount.toLocaleString('ru-RU')} ₽`
          ]}
          nextStep={lead ? `Открыть ${lead.id} и довести заявку до следующего статуса.` : 'Создать первую финзаявку и связать её со сделкой.'}
          owner="Финансы / accounting / executive"
          blockers={draft.length ? `${draft.length} заявок ещё не отправлены в работу.` : 'критичных блокеров по финконтру не видно'}
          actions={[
            { href: lead ? `/finance/${lead.id}` : '/payments', label: lead ? 'Открыть верхнюю заявку' : 'Открыть платежи' },
            { href: '/payments', label: 'Ledger / payments', variant: 'secondary' },
            { href: '/documents', label: 'Документы', variant: 'secondary' }
          ]}
        />

        <section className="dashboard-grid-4">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Всего заявок</div>
            <div className="dashboard-card-value">{view.applications.length}</div>
            <div className="dashboard-card-caption">От draft до funded.</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">В review / approval</div>
            <div className="dashboard-card-value">{active.length}</div>
            <div className="dashboard-card-caption">Операционные и кредитные решения в процессе.</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Профинансировано</div>
            <div className="dashboard-card-value">{funded.length}</div>
            <div className="dashboard-card-caption">Заявки, у которых уже открылся money flow.</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Waterfall steps</div>
            <div className="dashboard-card-value">{view.waterfalls.length}</div>
            <div className="dashboard-card-caption">Reserve, partial payout и final release живут внутри заявки.</div>
          </div>
        </section>

        <FinanceConsole initialProducts={view.products} initialApplications={view.applications} />

        <ModuleHub
          title="Что должен продолжать финансовый контур"
          subtitle="Финансы не должны быть тупиком: после заявки нужен переход в сделку, компанию, документы и платежи."
          items={[
            { href: '/payments', label: 'Платежи', detail: 'Ledger, release, hold и callback-журнал.', icon: '₽', meta: `${funded.length} funded`, tone: 'green' },
            { href: '/documents', label: 'Документы', detail: 'Проверить пакет, без которого нельзя выпускать деньги.', icon: '⌁', meta: 'green docs', tone: 'amber' },
            { href: '/companies', label: 'Компании', detail: 'Платёжная дисциплина, KYB и finance readiness.', icon: '⌘', meta: 'KYB', tone: 'gray' },
            { href: '/deals', label: 'Сделки', detail: 'Вернуться в сделочный контур и связать решение с исполнением.', icon: '≣', meta: 'deal-linked', tone: 'blue' },
            { href: '/market-center', label: 'Ценовой центр', detail: 'Сравнить buyer-side finance с netback и скоростью денег.', icon: '₿', meta: 'decision', tone: 'green' },
            { href: '/knowledge/KB-FINANCE-WATERFALL', label: 'Playbook по waterfall', detail: 'Как проводить частичную выплату и удержание спорной части.', icon: '≡', meta: 'playbook', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title={lead ? 'Открыть верхнюю заявку и перевести её дальше' : 'Создать первую заявку на финансирование'}
          detail={lead ? `${lead.companyName} · ${lead.amount.toLocaleString('ru-RU')} ₽ · ${lead.status}` : 'Финконтур пустым быть не должен: без заявки нет money layer.'}
          primary={{ href: lead ? `/finance/${lead.id}` : '/finance', label: lead ? 'Открыть заявку' : 'Остаться в финконтуре' }}
          secondary={[{ href: '/payments', label: 'Платежи' }, { href: '/companies', label: 'Компании' }]}
        />
      </AppShell>
    </PageAccessGuard>
  );
}
