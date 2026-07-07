'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, FileText, Gauge, ShieldCheck, Truck } from 'lucide-react';
import { DEALS, DISPUTES, getDealById, getDisputeById } from '@/lib/v7r/data';
import { formatCompactMoney } from '@/lib/v7r/helpers';

type GuideTone = 'risk' | 'money' | 'docs' | 'logistics' | 'neutral';

type GuideAction = {
  label: string;
  href: string;
  tone?: GuideTone;
};

type GuideConfig = {
  title: string;
  reason: string;
  result: string;
  primary: GuideAction;
  secondary: GuideAction[];
  facts: Array<{ label: string; value: string }>;
  tone: GuideTone;
};

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);

const toneStyle: Record<GuideTone, { bg: string; border: string; text: string; icon: string }> = {
  risk: { bg: 'rgba(220,38,38,0.065)', border: 'rgba(220,38,38,0.16)', text: '#B91C1C', icon: '#DC2626' },
  money: { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', text: '#075F4A', icon: '#0A7A5F' },
  docs: { bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.16)', text: '#1D4ED8', icon: '#2563EB' },
  logistics: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', text: '#B45309', icon: '#D97706' },
  neutral: { bg: 'rgba(15,23,42,0.035)', border: 'rgba(15,23,42,0.10)', text: '#0F172A', icon: '#475569' },
};

function normalize(pathname: string | null) {
  return (pathname || '/platform-v7').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function iconForTone(tone: GuideTone) {
  if (tone === 'risk') return AlertTriangle;
  if (tone === 'money') return Banknote;
  if (tone === 'docs') return FileText;
  if (tone === 'logistics') return Truck;
  return Gauge;
}

function actionStyle(tone: GuideTone, primary = false) {
  const style = toneStyle[tone];
  return {
    minHeight: primary ? 46 : 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: primary ? '12px 14px' : '9px 11px',
    borderRadius: primary ? 15 : 13,
    border: `1px solid ${primary ? style.icon : style.border}`,
    background: primary ? style.icon : '#fff',
    color: primary ? '#fff' : style.text,
    textDecoration: 'none',
    fontSize: primary ? 14 : 12,
    fontWeight: 880,
    lineHeight: 1.1,
    whiteSpace: 'normal' as const,
  };
}

function topRiskDeal() {
  return [...DEALS].sort((left, right) => right.riskScore - left.riskScore)[0];
}

function configFor(pathname: string): GuideConfig | null {
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/platform-v7/role-preview')) return null;
  if (pathname === '/platform-v7/ai') return null;

  const parts = pathname.split('/').filter(Boolean);
  const first = parts[1] || '';
  const second = parts[2];
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
  const riskDeal = topRiskDeal();

  if (first === 'control-tower' || first === 'operator') {
    return {
      title: 'Сначала разберите самую рискованную сделку',
      reason: 'Центр контроля нужен не для просмотра таблиц, а чтобы снять главную остановку по деньгам, документам или спору.',
      result: 'После действия станет понятно, кто держит следующий шаг и какой экран открывать дальше.',
      primary: { label: `Открыть ${riskDeal.id}`, href: `/platform-v7/deals/${riskDeal.id}`, tone: 'risk' },
      secondary: [
        { label: 'Все сделки', href: '/platform-v7/deals' },
        { label: 'Споры', href: '/platform-v7/disputes', tone: 'risk' },
        { label: 'Банк', href: '/platform-v7/bank', tone: 'money' },
      ],
      facts: [
        { label: 'Резерв', value: formatCompactMoney(totalReserved) },
        { label: 'Удержание', value: formatCompactMoney(totalHold) },
        { label: 'Активно', value: String(activeDeals) },
      ],
      tone: 'risk',
    };
  }

  if (first === 'deals' && second) {
    const deal = getDealById(second);
    return {
      title: deal ? `Сделка ${deal.id}: найдите следующий подтверждаемый шаг` : 'Сделка не найдена',
      reason: deal ? 'Карточка сделки должна отвечать на один вопрос: что сейчас мешает движению денег, документов или груза.' : 'Откройте список сделок и выберите доступный рабочий объект.',
      result: deal ? 'Сначала проверьте статус, удержание и спор, затем переходите к нужному действию.' : 'Переход вернёт к списку доступных сделок.',
      primary: deal ? { label: deal.status === 'quality_disputed' ? 'Открыть спор' : 'Проверить деньги', href: deal.status === 'quality_disputed' ? `/platform-v7/disputes/${deal.dispute?.id ?? ''}` : '/platform-v7/bank', tone: deal.status === 'quality_disputed' ? 'risk' : 'money' } : { label: 'Вернуться к сделкам', href: '/platform-v7/deals' },
      secondary: [
        { label: 'Все сделки', href: '/platform-v7/deals' },
        { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' },
        { label: 'Разбор шага', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` },
      ],
      facts: deal ? [
        { label: 'Резерв', value: formatCompactMoney(deal.reservedAmount) },
        { label: 'Удержание', value: formatCompactMoney(deal.holdAmount) },
        { label: 'Риск', value: String(deal.riskScore) },
      ] : [{ label: 'Объект', value: second }],
      tone: deal?.status === 'quality_disputed' ? 'risk' : 'money',
    };
  }

  if (first === 'deals') {
    return {
      title: 'Выберите сделку, где действие даст результат',
      reason: 'Список сделок должен вести к конкретному объекту, а не заставлять искать смысл в таблице.',
      result: 'Откройте сделку с риском, удержанием или незакрытыми документами.',
      primary: { label: `Открыть ${riskDeal.id}`, href: `/platform-v7/deals/${riskDeal.id}`, tone: 'risk' },
      secondary: [
        { label: 'Фильтр по риску', href: '/platform-v7/control-tower', tone: 'risk' },
        { label: 'Деньги', href: '/platform-v7/money', tone: 'money' },
        { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' },
      ],
      facts: [
        { label: 'Сделок', value: String(DEALS.length) },
        { label: 'Активно', value: String(activeDeals) },
        { label: 'Удержание', value: formatCompactMoney(totalHold) },
      ],
      tone: 'neutral',
    };
  }

  if (first === 'disputes' && second) {
    const dispute = getDisputeById(second);
    return {
      title: dispute ? `Спор ${dispute.id}: закройте недостающие доказательства` : 'Спор не найден',
      reason: 'Спор должен показывать сумму под удержанием, владельца следующего шага и неполный пакет доказательств.',
      result: 'После пополнения пакета можно переходить к решению или банковской проверке.',
      primary: dispute ? { label: 'Открыть связанную сделку', href: `/platform-v7/deals/${dispute.dealId}`, tone: 'risk' } : { label: 'Вернуться к спорам', href: '/platform-v7/disputes', tone: 'risk' },
      secondary: [
        { label: 'Все споры', href: '/platform-v7/disputes', tone: 'risk' },
        { label: 'Разбор шага', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` },
      ],
      facts: dispute ? [
        { label: 'Удержание', value: formatCompactMoney(dispute.holdAmount) },
        { label: 'Доказательства', value: `${dispute.evidence.uploaded}/${dispute.evidence.total}` },
        { label: 'Срок', value: `${dispute.slaDaysLeft} дн.` },
      ] : [{ label: 'Объект', value: second }],
      tone: 'risk',
    };
  }

  if (first === 'disputes') {
    const urgent = DISPUTES.filter((item) => item.slaDaysLeft <= 1).length;
    return {
      title: 'Разберите спор, который держит деньги',
      reason: 'Главный смысл раздела — не список споров, а снятие удержания через доказательства и решение.',
      result: 'Начните со спора с ближайшим сроком или максимальной суммой удержания.',
      primary: { label: 'Открыть первый спор', href: `/platform-v7/disputes/${DISPUTES[0]?.id ?? ''}`, tone: 'risk' },
      secondary: [
        { label: 'Сделки', href: '/platform-v7/deals' },
        { label: 'Банк', href: '/platform-v7/bank', tone: 'money' },
      ],
      facts: [
        { label: 'Споров', value: String(DISPUTES.length) },
        { label: 'Срочно', value: String(urgent) },
        { label: 'Удержание', value: formatCompactMoney(DISPUTES.reduce((sum, item) => sum + item.holdAmount, 0)) },
      ],
      tone: 'risk',
    };
  }

  if (first === 'bank' || first === 'money') {
    return {
      title: 'Проверьте основание банковского шага',
      reason: 'Денежный экран должен показывать не обещание оплаты, а основание, удержание, спор и документы.',
      result: 'Если документы, качество и спор закрыты — можно переходить к банковской проверке.',
      primary: { label: 'Открыть банковский контур', href: '/platform-v7/bank', tone: 'money' },
      secondary: [
        { label: 'Сделки', href: '/platform-v7/deals' },
        { label: 'Споры', href: '/platform-v7/disputes', tone: 'risk' },
        { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' },
      ],
      facts: [
        { label: 'Резерв', value: formatCompactMoney(totalReserved) },
        { label: 'Удержание', value: formatCompactMoney(totalHold) },
        { label: 'Активно', value: String(activeDeals) },
      ],
      tone: 'money',
    };
  }

  if (first === 'documents' || first === 'compliance' || first === 'connectors') {
    return {
      title: 'Закройте документную остановку',
      reason: 'Документы и допуск должны вести к следующему подтверждённому шагу, а не к формальному просмотру.',
      result: 'Проверьте, какой документ или полномочие держит сделку, деньги или спор.',
      primary: { label: first === 'compliance' ? 'Открыть допуск' : 'Открыть документы', href: first === 'compliance' ? '/platform-v7/compliance' : '/platform-v7/documents', tone: 'docs' },
      secondary: [
        { label: 'Сделки', href: '/platform-v7/deals' },
        { label: 'Банк', href: '/platform-v7/bank', tone: 'money' },
        { label: 'Разбор шага', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` },
      ],
      facts: [
        { label: 'Пакет', value: 'проверка' },
        { label: 'Связь', value: 'сделка' },
        { label: 'Результат', value: 'допуск' },
      ],
      tone: 'docs',
    };
  }

  if (first === 'logistics' || first === 'driver' || first === 'elevator' || first === 'lab' || first === 'surveyor' || first === 'field') {
    return {
      title: 'Подтвердите ближайший факт исполнения',
      reason: 'Полевой экран должен вести к одному понятному действию: рейс, прибытие, вес, проба, акт или проблема.',
      result: 'Подтверждение попадёт в контур сделки и станет основанием для следующего шага.',
      primary: { label: first === 'driver' ? 'Открыть маршрут' : first === 'elevator' ? 'Начать приёмку' : first === 'lab' ? 'Внести качество' : 'Открыть рейс', href: first === 'driver' ? '/platform-v7/driver' : first === 'elevator' ? '/platform-v7/elevator' : first === 'lab' ? '/platform-v7/lab' : '/platform-v7/logistics', tone: 'logistics' },
      secondary: [
        { label: 'Сделки', href: '/platform-v7/deals' },
        { label: 'Документы рейса', href: '/platform-v7/documents', tone: 'docs' },
        { label: 'Сообщить проблему', href: '/platform-v7/disputes', tone: 'risk' },
      ],
      facts: [
        { label: 'Объект', value: 'рейс' },
        { label: 'Факт', value: 'подтверждение' },
        { label: 'Связь', value: 'сделка' },
      ],
      tone: 'logistics',
    };
  }

  if (first === 'seller') {
    return {
      title: 'Проверьте, что мешает оплате продавцу',
      reason: 'Кабинет продавца должен вести к партии, документам, отгрузке или спору.',
      result: 'Закрытый пакет переводит сделку к банковскому шагу без раскрытия лишних данных.',
      primary: { label: 'Открыть предложения', href: '/platform-v7/seller/offers', tone: 'money' },
      secondary: [
        { label: 'Партии', href: '/platform-v7/seller/lots' },
        { label: 'Отгрузки', href: '/platform-v7/seller/batches', tone: 'logistics' },
        { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' },
      ],
      facts: [
        { label: 'Фокус', value: 'документы' },
        { label: 'Риск', value: 'спор' },
        { label: 'Дальше', value: 'банк' },
      ],
      tone: 'money',
    };
  }

  if (first === 'buyer' || first === 'procurement' || first === 'proposals') {
    return {
      title: 'Выберите поставку, которую можно довести до сделки',
      reason: 'Покупатель должен видеть цену, качество, резерв денег и следующий шаг по приёмке.',
      result: 'После выбора предложения переходите к сделке, документам и банковскому основанию.',
      primary: { label: 'Создать запрос', href: '/platform-v7/buyer/rfq', tone: 'money' },
      secondary: [
        { label: 'Предложения', href: '/platform-v7/proposals' },
        { label: 'Сделки', href: '/platform-v7/deals' },
        { label: 'Деньги', href: '/platform-v7/money', tone: 'money' },
      ],
      facts: [
        { label: 'Фокус', value: 'качество' },
        { label: 'Дальше', value: 'сделка' },
        { label: 'Риск', value: 'приёмка' },
      ],
      tone: 'money',
    };
  }

  return {
    title: 'Выберите ближайшее рабочее действие',
    reason: 'Каждый экран должен вести к объекту сделки: деньги, документы, рейс, приёмка или спор.',
    result: 'Начните с активных сделок или центра контроля.',
    primary: { label: 'Открыть сделки', href: '/platform-v7/deals' },
    secondary: [
      { label: 'Центр контроля', href: '/platform-v7/control-tower', tone: 'risk' },
      { label: 'Банк', href: '/platform-v7/bank', tone: 'money' },
      { label: 'Разбор шага', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` },
    ],
    facts: [
      { label: 'Контур', value: 'сделка' },
      { label: 'Дальше', value: 'действие' },
      { label: 'След', value: 'журнал' },
    ],
    tone: 'neutral',
  };
}

export function WorkStepGuide() {
  const pathname = normalize(usePathname());
  const config = configFor(pathname);
  if (!config) return null;

  const Icon = iconForTone(config.tone);
  const style = toneStyle[config.tone];

  return (
    <section data-testid="platform-v7-work-step-guide" aria-label="Что сделать сейчас" style={{ border: `1px solid ${style.border}`, borderRadius: 22, background: '#fff', boxShadow: 'var(--pc-shadow-sm)', padding: 16, display: 'grid', gap: 14, maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 360px)', gap: 14, alignItems: 'stretch' }} className="p7-work-step-guide-grid">
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '7px 10px', borderRadius: 999, background: style.bg, border: `1px solid ${style.border}`, color: style.text, fontSize: 11, fontWeight: 880, textTransform: 'uppercase', letterSpacing: '0.055em' }}>
            <Icon size={15} strokeWidth={2.25} /> Что сделать сейчас
          </div>
          <div style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 'clamp(20px, 4.9vw, 30px)', lineHeight: 1.08, fontWeight: 930, letterSpacing: '-0.045em' }}>{config.title}</div>
          <div style={{ color: 'var(--pc-text-secondary, #475569)', fontSize: 13, lineHeight: 1.55, maxWidth: 880 }}>{config.reason}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8, maxWidth: 620 }}>
            {config.facts.map((item) => (
              <div key={`${item.label}-${item.value}`} style={{ minWidth: 0, padding: '10px 11px', borderRadius: 14, background: 'var(--pc-shell-surface-soft, #F8FAFB)', border: '1px solid var(--pc-border, #E4E6EA)' }}>
                <div style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.055em' }}>{item.label}</div>
                <div style={{ marginTop: 4, color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 850, overflowWrap: 'anywhere' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 0, display: 'grid', gap: 10, alignContent: 'start', padding: 12, borderRadius: 18, background: style.bg, border: `1px solid ${style.border}` }}>
          <Link href={config.primary.href} style={actionStyle(config.primary.tone ?? config.tone, true)}>
            <span>{config.primary.label}</span>
            <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
          <div style={{ color: 'var(--pc-text-secondary, #475569)', fontSize: 12, lineHeight: 1.45, fontWeight: 650 }}>{config.result}</div>
          <div style={{ display: 'grid', gap: 7 }}>
            {config.secondary.map((action) => (
              <Link key={`${action.label}-${action.href}`} href={action.href} style={actionStyle(action.tone ?? 'neutral')}>
                <span>{action.label}</span>
                <ArrowRight size={14} strokeWidth={2.2} />
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width: 760px){
          [data-testid="platform-v7-work-step-guide"]{padding:14px!important;border-radius:20px!important}
          .p7-work-step-guide-grid{grid-template-columns:1fr!important}
        }
      `}</style>
    </section>
  );
}
