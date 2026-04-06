import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';

type RoleLink = { href: string; label: string; meta: string };
type RoleGuide = { title: string; summary: string; owner: string; signals: string[]; links: RoleLink[] };

const ROLE_GUIDES: Record<string, RoleGuide> = {
  farmer: {
    title: 'Фермер / Продавец',
    summary: 'Ведёт рынок, lot rail, buyer decision и дальше в execution / money.',
    owner: 'farmer rail',
    signals: ['market desk', 'lot rail', 'buyer trust', 'money speed'],
    links: [
      { href: '/lots', label: 'Лоты и торги', meta: 'lot rail' },
      { href: '/market-center', label: 'Ценовой центр', meta: 'market' },
      { href: '/deals', label: 'Сделки', meta: 'execution' },
      { href: '/documents', label: 'Документы', meta: 'docs' },
      { href: '/farmer-mobile', label: 'Мобильный режим', meta: 'mobile' },
    ],
  },
  buyer: {
    title: 'Покупатель',
    summary: 'Ведёт закупку, dispatch, quality, documents и payment rail.',
    owner: 'buyer rail',
    signals: ['deal rail', 'dispatch', 'quality', 'payments'],
    links: [
      { href: '/deals', label: 'Сделки', meta: 'deal rail' },
      { href: '/dispatch', label: 'Dispatch', meta: 'routing' },
      { href: '/payments', label: 'Платежи', meta: 'money' },
      { href: '/documents', label: 'Документы', meta: 'docs' },
      { href: '/purchase-requests', label: 'Запросы на закупку', meta: 'demand' },
    ],
  },
  logistician: {
    title: 'Логист',
    summary: 'Управляет рейсами, ETA, очередью приёмки и весовой.',
    owner: 'logistics rail',
    signals: ['dispatch', 'ETA', 'receiving queue', 'weighbridge'],
    links: [
      { href: '/dispatch', label: 'Dispatch центр', meta: 'routing' },
      { href: '/logistics', label: 'Логистика', meta: 'trips' },
      { href: '/receiving', label: 'Приёмка', meta: 'queue' },
      { href: '/weighbridge', label: 'Весовая', meta: 'weight' },
      { href: '/railway', label: 'Railway', meta: 'rail' },
    ],
  },
  driver: {
    title: 'Водитель',
    summary: 'Работает с рейсом: назначение, маршрут, события, handoff.',
    owner: 'driver rail',
    signals: ['assignment', 'GPS route', 'events', 'delivery'],
    links: [
      { href: '/driver-mobile', label: 'Режим водителя', meta: 'mobile' },
      { href: '/dispatch', label: 'Dispatch', meta: 'assignment' },
      { href: '/logistics', label: 'Логистика', meta: 'trips' },
    ],
  },
  lab: {
    title: 'Лаборатория',
    summary: 'Проводит анализ качества, формирует протокол, передаёт в settlement или dispute.',
    owner: 'quality rail',
    signals: ['sample', 'quality protocol', 'settlement handoff', 'dispute flag'],
    links: [
      { href: '/lab', label: 'Лаборатория', meta: 'samples' },
      { href: '/lab-mobile', label: 'Мобильный режим', meta: 'mobile' },
      { href: '/receiving', label: 'Приёмка', meta: 'source' },
      { href: '/disputes', label: 'Споры', meta: 'escalation' },
    ],
  },
  elevator: {
    title: 'Элеватор / Приёмка',
    summary: 'Управляет слотами очереди, весовой, выгрузкой и хранением.',
    owner: 'elevator rail',
    signals: ['queue slots', 'weighbridge', 'unloading', 'storage'],
    links: [
      { href: '/receiving', label: 'Очередь приёмки', meta: 'slots' },
      { href: '/weighbridge', label: 'Весовая', meta: 'weight' },
      { href: '/inventory', label: 'Инвентарь склада', meta: 'storage' },
      { href: '/lab', label: 'Лаборатория', meta: 'quality' },
      { href: '/elevator-mobile', label: 'Мобильный режим', meta: 'mobile' },
    ],
  },
  accounting: {
    title: 'Бухгалтерия',
    summary: 'Ведёт платёжный контур, финзаявки, выписки и экспорт в 1С.',
    owner: 'accounting rail',
    signals: ['payments', 'finance apps', 'bank statements', '1C export'],
    links: [
      { href: '/payments', label: 'Платёжный контур', meta: 'ledger' },
      { href: '/finance', label: 'Финансирование', meta: 'apps' },
      { href: '/settlement', label: 'Расчёты', meta: 'settlement' },
      { href: '/export-1c', label: 'Экспорт в 1С', meta: '1C' },
      { href: '/sber', label: 'Банковый контур', meta: 'bank' },
    ],
  },
  executive: {
    title: 'Руководитель',
    summary: 'Получает аналитику, контролирует сделки, финансы и репутацию платформы.',
    owner: 'executive rail',
    signals: ['analytics', 'deal KPIs', 'risk dashboard', 'trust scores'],
    links: [
      { href: '/analytics', label: 'Аналитика', meta: 'KPI' },
      { href: '/deals', label: 'Сделки', meta: 'portfolio' },
      { href: '/finance', label: 'Финансы', meta: 'money' },
      { href: '/reputation-control', label: 'Репутация', meta: 'trust' },
      { href: '/forecasting', label: 'Прогнозы', meta: 'forecast' },
    ],
  },
  support_manager: {
    title: 'Оператор поддержки',
    summary: 'Работает с очередями, блокерами, спорами, эскалациями и overrides.',
    owner: 'operator rail',
    signals: ['queues', 'blockers', 'disputes', 'escalations', 'overrides'],
    links: [
      { href: '/operator-cockpit', label: 'Operator cockpit', meta: 'control' },
      { href: '/operator-cockpit/cases', label: 'Кейсы', meta: 'cases' },
      { href: '/disputes', label: 'Споры', meta: 'disputes' },
      { href: '/support', label: 'Support', meta: 'tickets' },
      { href: '/anti-fraud', label: 'Anti-fraud', meta: 'fraud' },
    ],
  },
  admin: {
    title: 'Администратор',
    summary: 'Управляет ролями, компаниями, коннекторами и аудитом.',
    owner: 'admin rail',
    signals: ['roles', 'companies', 'connectors', 'audit log'],
    links: [
      { href: '/companies', label: 'Компании', meta: 'orgs' },
      { href: '/connectors', label: 'Коннекторы', meta: 'integrations' },
      { href: '/audit', label: 'Аудит', meta: 'log' },
      { href: '/roles', label: 'Реестр ролей', meta: 'RBAC' },
      { href: '/operator-cockpit', label: 'Operator cockpit', meta: 'ops' },
    ],
  },
};

export default function RoleGuidePage({ params }: { params: { id: string } }) {
  const guide = ROLE_GUIDES[params.id.toLowerCase()];
  if (!guide) notFound();

  const toneMap = ['blue', 'green', 'amber', 'gray', 'gray'] as const;

  return (
    <PageFrame
      title={guide.title}
      subtitle={guide.summary}
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/cabinet', label: 'Кабинеты' }, { label: guide.title }]} />}
    >
      <SourceNote source="embedded role guide" warning="Role guide — переход в рабочий rail роли, а не справочная страница." compact />
      <DetailHero
        kicker="Кабинет роли"
        title={guide.title}
        description={guide.summary}
        chips={guide.signals}
        nextStep="Открыть основной рабочий rail и начать работу."
        owner={guide.owner}
        blockers="Не оставайтесь в guide page — переходите сразу в модуль."
        actions={guide.links.slice(0, 3).map((item, index) => ({
          href: item.href,
          label: item.label,
          variant: index === 0 ? 'primary' : 'secondary' as const,
        }))}
      />
      <ModuleHub
        title="Связанные rails"
        subtitle="Переходите в рабочие модули — не просматривайте guide."
        items={guide.links.map((item, i) => ({
          href: item.href,
          label: item.label,
          detail: `Открыть ${item.label.toLowerCase()} для этой роли.`,
          icon: ['→', '⌁', '≣', '◌', '✦'][i % 5],
          meta: item.meta,
          tone: toneMap[i % toneMap.length],
        }))}
      />
      <NextStepBar
        title={`Перейти в ${guide.links[0].label}`}
        detail={guide.summary}
        primary={{ href: guide.links[0].href, label: guide.links[0].label }}
        secondary={guide.links.slice(1, 3).map((item) => ({ href: item.href, label: item.label }))}
      />
    </PageFrame>
  );
}
