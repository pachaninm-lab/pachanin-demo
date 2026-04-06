import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { CompanyDirectoryWorkspace } from '../../components/company-directory-workspace';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function CompaniesPage() {
  const state = await readCommercialWorkspace();
  const verified = state.companyProfiles.filter((item) => String(item.verification).toLowerCase().includes('green') || String(item.verification).toLowerCase().includes('verified')).length;
  const financeReady = state.companyProfiles.filter((item) => String(item.financeReadiness).toLowerCase().includes('ready') || String(item.financeReadiness).toLowerCase().includes('green')).length;
  const activeLeads = state.companyLeads.filter((item) => ['NEW', 'IN_PROGRESS', 'QUALIFIED'].includes(item.status)).length;
  const lead = state.companyProfiles[0];

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Каталог компаний ограничен" subtitle="Карточки контрагентов открываются только после входа.">
      <AppShell title="Каталог компаний и low-friction lead flow" subtitle="Компании, статусы допуска, дисциплина оплаты и быстрый вход в RFQ / price request / finance / dispatch.">
        <SourceNote source="commercial workspace / persisted state" warning="Каталог компаний теперь не статичен: по каждой карточке можно сразу зафиксировать RFQ, price request, KYB, finance или dispatch interest." compact />

        <DetailHero
          kicker="Counterparty directory"
          title="Компания должна вести в сделку, а не быть тупым справочником"
          description="Профиль контрагента нужен для быстрого входа в процесс: price request, RFQ, KYB, логистика и деньги без длинного онбординга."
          chips={[`компаний ${state.companyProfiles.length}`, `verified ${verified}`, `finance ready ${financeReady}`, `active leads ${activeLeads}`]}
          nextStep={lead ? `Открыть ${lead.name} и перевести карточку компании в действие.` : 'Создать первую карточку компании и зафиксировать интерес.'}
          owner="Trading / ops / finance"
          blockers={activeLeads ? `${activeLeads} интересов уже открыты и требуют обработки.` : 'критичных блокеров по каталогу не видно'}
          actions={lead ? [
            { href: `/companies/${lead.id}`, label: 'Открыть верхнюю компанию' },
            { href: '/market-center', label: 'Ценовой центр', variant: 'secondary' },
            { href: '/purchase-requests', label: 'RFQ', variant: 'secondary' }
          ] : [
            { href: '/purchase-requests', label: 'RFQ' },
            { href: '/market-center', label: 'Ценовой центр', variant: 'secondary' }
          ]}
        />

        <section className="dashboard-grid-4">
          <div className="dashboard-card"><div className="dashboard-card-title">Компании</div><div className="dashboard-card-value">{state.companyProfiles.length}</div><div className="dashboard-card-caption">Фермеры, buyers, логисты и сервисные контрагенты.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Проверенные</div><div className="dashboard-card-value">{verified}</div><div className="dashboard-card-caption">Компании с зелёной или верифицированной карточкой.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Finance ready</div><div className="dashboard-card-value">{financeReady}</div><div className="dashboard-card-caption">Контрагенты, которые можно продолжать в финконтур.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Активные интересы</div><div className="dashboard-card-value">{activeLeads}</div><div className="dashboard-card-caption">RFQ, price request, KYB и другие входы в работу.</div></div>
        </section>

        <CompanyDirectoryWorkspace initialCompanies={state.companyProfiles} initialLeads={state.companyLeads} />

        <ModuleHub title="Что должно быть рядом с каталогом компаний" subtitle="Контрагентская карточка нужна только если из неё можно перейти в цену, RFQ, финансирование и логистику." items={[
          { href: '/market-center', label: 'Ценовой центр', detail: 'Проверить, у кого лучшая экономика и скорость денег.', icon: '₿', meta: 'decision', tone: 'green' },
          { href: '/purchase-requests', label: 'RFQ / закупки', detail: 'Сразу открыть запрос котировок по компании.', icon: '⌁', meta: 'procurement', tone: 'blue' },
          { href: '/finance', label: 'Финансы', detail: 'Перевести компанию в аванс, factor или buyer deferral.', icon: '₽', meta: 'money', tone: 'green' },
          { href: '/dispatch', label: 'Dispatch', detail: 'Подтянуть перевозчика или логистический канал.', icon: '→', meta: 'logistics', tone: 'gray' },
          { href: '/knowledge/KB-COMPANY-ENTRY', label: 'Playbook входа', detail: 'Как быстро перевести компанию из каталога в сделку.', icon: '≡', meta: 'guide', tone: 'gray' }
        ]} />

        <NextStepBar
          title={lead ? 'Открыть карточку компании и зафиксировать действие' : 'Создать первый входящий интерес'}
          detail={lead ? `${lead.name} · ${lead.segment} · ${lead.lastSignal}` : 'Каталог не должен стоять без действий.'}
          primary={lead ? { href: `/companies/${lead.id}`, label: 'Открыть компанию' } : { href: '/purchase-requests', label: 'Открыть RFQ' }}
          secondary={[{ href: '/market-center', label: 'Цены' }, { href: '/finance', label: 'Финансы' }]}
        />
      </AppShell>
    </PageAccessGuard>
  );
}
