import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

const calculators = [
  { id: 'netback', title: 'Netback', detail: 'Чистая цена после логистики, очереди, качества и money speed.', href: '/market-center' },
  { id: 'quality', title: 'Качество / deductions', detail: 'Пересчёт по качеству, премиям и штрафам.', href: '/lab' },
  { id: 'cashflow', title: 'Money timing', detail: 'Что происходит с деньгами между reserve, hold и final release.', href: '/payments' },
  { id: 'route', title: 'Route economics', detail: 'Сравнение плеча, ETA и риска handoff по маршрутам.', href: '/dispatch' },
];

export default function CalculatorPage() {
  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Калькуляторы доступны после входа" subtitle="Расчётный слой должен жить внутри рабочего контура, а не отдельно от сделки.">
      <PageFrame title="Калькулятор" subtitle="Netback, цена на воротах, логистика, deductions и сценарии сделки." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Калькулятор' }]} />}>
        <SourceNote source="embedded calculator rail" warning="Калькулятор нужен не как отдельный Excel. После расчёта пользователь должен сразу уходить в market, deal, dispatch или payments rail." compact />

        <DetailHero
          kicker="Decision calculators"
          title="Расчёт должен сразу вести к действию"
          description="Netback, quality impact, money timing и route economics нужны только если они сразу помогают выбрать buyer, lot, маршрут или payment path."
          chips={[`tools ${calculators.length}`, 'decision-first', 'linked rails']}
          nextStep="Открыть нужный расчёт и сразу перейти в связанный рабочий rail."
          owner="farmer / buyer / operator / finance"
          blockers="калькулятор не должен жить отдельно от market, deal, dispatch и money rails"
          actions={[
            { href: '/market-center', label: 'Ценовой центр' },
            { href: '/deals', label: 'Сделки', variant: 'secondary' },
            { href: '/payments', label: 'Платежи', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Расчёты</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {calculators.map((item) => (
              <Link key={item.id} href={item.href} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted small">{item.detail}</div>
                </div>
                <span className="mini-chip">Открыть</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="После расчёта пользователь должен идти туда, где принимает решение, а не оставаться в калькуляторе."
          items={[
            { href: '/market-center', label: 'Market center', detail: 'Применить netback к выбору buyer и цены.', icon: '₿', meta: 'pricing', tone: 'green' },
            { href: '/deals', label: 'Deal rail', detail: 'Применить расчёт к сделке и следующему owner action.', icon: '≣', meta: 'workflow', tone: 'blue' },
            { href: '/dispatch', label: 'Dispatch', detail: 'Применить route economics к маршруту и ETA.', icon: '→', meta: 'logistics', tone: 'amber' },
            { href: '/payments', label: 'Payments', detail: 'Проверить money timing и release path.', icon: '₽', meta: 'money', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть нужный расчёт и перейти в рабочий rail"
          detail="Следующий шаг — не считать ради цифры, а сразу применить расчёт к цене, сделке, логистике или деньгам."
          primary={{ href: '/market-center', label: 'Открыть market center' }}
          secondary={[{ href: '/deals', label: 'Deals' }, { href: '/payments', label: 'Payments' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
