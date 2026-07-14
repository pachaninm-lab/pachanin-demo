'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Banknote, FileText, Gauge, ShieldAlert, Truck } from 'lucide-react';
import { DEALS, DISPUTES, getDealById, getDisputeById } from '@/lib/v7r/data';
import { formatCompactMoney } from '@/lib/v7r/helpers';
import styles from './WorkStepGuide.module.css';

type Tone = 'risk' | 'money' | 'docs' | 'logistics' | 'neutral';
type Action = { label: string; href: string; tone?: Tone };
type Config = { title: string; primary: Action; actions: Action[]; facts: Array<{ label: string; value: string }>; tone: Tone };

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/help', '/platform-v7/pricing', '/platform-v7/roadmap', '/platform-v7/deal-flow', '/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/docs']);
const toneMap: Record<Tone, { bg: string; border: string; text: string; icon: string }> = {
  risk: { bg: 'rgba(220,38,38,0.055)', border: 'rgba(220,38,38,0.15)', text: '#B91C1C', icon: '#DC2626' },
  money: { bg: 'rgba(10,122,95,0.07)', border: 'rgba(10,122,95,0.17)', text: '#075F4A', icon: '#0A7A5F' },
  docs: { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.15)', text: '#1D4ED8', icon: '#2563EB' },
  logistics: { bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.17)', text: '#B45309', icon: '#D97706' },
  neutral: { bg: 'rgba(15,23,42,0.032)', border: 'rgba(15,23,42,0.10)', text: '#0F172A', icon: '#475569' },
};

function normalize(pathname: string | null) {
  return (pathname || '/platform-v7').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}
function topRiskDeal() {
  return [...DEALS].sort((left, right) => right.riskScore - left.riskScore)[0];
}
function iconFor(tone: Tone) {
  if (tone === 'risk') return ShieldAlert;
  if (tone === 'money') return Banknote;
  if (tone === 'docs') return FileText;
  if (tone === 'logistics') return Truck;
  return Gauge;
}
function linkStyle(tone: Tone, primary = false) {
  const t = toneMap[tone];
  return {
    minHeight: primary ? 38 : 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: primary ? '8px 11px' : '7px 10px',
    borderRadius: primary ? 13 : 12,
    border: `1px solid ${primary ? t.icon : t.border}`,
    background: primary ? t.icon : '#fff',
    color: primary ? '#fff' : t.text,
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: 'nowrap' as const,
  };
}
function configFor(pathname: string): Config | null {
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/platform-v7/role-preview') || pathname === '/platform-v7/ai') return null;

  const parts = pathname.split('/').filter(Boolean);
  const first = parts[1] || '';
  const second = parts[2];
  const riskDeal = topRiskDeal();
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;

  if (first === 'control-tower' || first === 'operator') return {
    title: 'Операции',
    primary: { label: `Открыть ${riskDeal.id}`, href: `/platform-v7/deals/${riskDeal.id}`, tone: 'risk' },
    actions: [{ label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Споры', href: '/platform-v7/disputes', tone: 'risk' }, { label: 'Банк', href: '/platform-v7/bank', tone: 'money' }],
    facts: [{ label: 'резерв', value: formatCompactMoney(totalReserved) }, { label: 'удержание', value: formatCompactMoney(totalHold) }, { label: 'активно', value: String(activeDeals) }],
    tone: 'risk',
  };

  if (first === 'deals' && second) {
    const deal = getDealById(second);
    return {
      title: deal ? `Сделка ${deal.id}` : 'Сделка',
      primary: deal?.status === 'quality_disputed' ? { label: 'Открыть спор', href: `/platform-v7/disputes/${deal.dispute?.id ?? ''}`, tone: 'risk' } : { label: 'Проверить деньги', href: '/platform-v7/bank', tone: 'money' },
      actions: [{ label: 'Все сделки', href: '/platform-v7/deals' }, { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' }, { label: 'Разбор', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` }],
      facts: deal ? [{ label: 'резерв', value: formatCompactMoney(deal.reservedAmount) }, { label: 'удержание', value: formatCompactMoney(deal.holdAmount) }, { label: 'риск', value: String(deal.riskScore) }] : [{ label: 'объект', value: second }],
      tone: deal?.status === 'quality_disputed' ? 'risk' : 'money',
    };
  }

  if (first === 'deals') return {
    title: 'Сделки',
    primary: { label: `Открыть ${riskDeal.id}`, href: `/platform-v7/deals/${riskDeal.id}`, tone: 'risk' },
    actions: [{ label: 'Риски', href: '/platform-v7/control-tower', tone: 'risk' }, { label: 'Деньги', href: '/platform-v7/money', tone: 'money' }, { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' }],
    facts: [{ label: 'всего', value: String(DEALS.length) }, { label: 'активно', value: String(activeDeals) }, { label: 'удержание', value: formatCompactMoney(totalHold) }],
    tone: 'neutral',
  };

  if (first === 'disputes' && second) {
    const dispute = getDisputeById(second);
    return {
      title: dispute ? `Спор ${dispute.id}` : 'Спор',
      primary: dispute ? { label: 'Связанная сделка', href: `/platform-v7/deals/${dispute.dealId}`, tone: 'risk' } : { label: 'Все споры', href: '/platform-v7/disputes', tone: 'risk' },
      actions: [{ label: 'Все споры', href: '/platform-v7/disputes', tone: 'risk' }, { label: 'Разбор', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` }],
      facts: dispute ? [{ label: 'удержание', value: formatCompactMoney(dispute.holdAmount) }, { label: 'доказательства', value: `${dispute.evidence.uploaded}/${dispute.evidence.total}` }, { label: 'срок', value: `${dispute.slaDaysLeft} дн.` }] : [{ label: 'объект', value: second }],
      tone: 'risk',
    };
  }

  if (first === 'disputes') return {
    title: 'Споры',
    primary: { label: 'Открыть спор', href: `/platform-v7/disputes/${DISPUTES[0]?.id ?? ''}`, tone: 'risk' },
    actions: [{ label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Банк', href: '/platform-v7/bank', tone: 'money' }],
    facts: [{ label: 'всего', value: String(DISPUTES.length) }, { label: 'срочно', value: String(DISPUTES.filter((item) => item.slaDaysLeft <= 1).length) }, { label: 'удержание', value: formatCompactMoney(DISPUTES.reduce((sum, item) => sum + item.holdAmount, 0)) }],
    tone: 'risk',
  };

  if (first === 'bank' || first === 'money') return {
    title: 'Деньги',
    primary: { label: 'Банковский контур', href: '/platform-v7/bank', tone: 'money' },
    actions: [{ label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Споры', href: '/platform-v7/disputes', tone: 'risk' }, { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' }],
    facts: [{ label: 'резерв', value: formatCompactMoney(totalReserved) }, { label: 'удержание', value: formatCompactMoney(totalHold) }, { label: 'активно', value: String(activeDeals) }],
    tone: 'money',
  };

  if (first === 'documents' || first === 'compliance' || first === 'connectors') return {
    title: first === 'compliance' ? 'Допуск' : 'Документы',
    primary: { label: first === 'compliance' ? 'Проверить допуск' : 'Открыть документы', href: first === 'compliance' ? '/platform-v7/compliance' : '/platform-v7/documents', tone: 'docs' },
    actions: [{ label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Банк', href: '/platform-v7/bank', tone: 'money' }, { label: 'Разбор', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` }],
    facts: [{ label: 'пакет', value: 'проверка' }, { label: 'связь', value: 'сделка' }, { label: 'результат', value: 'допуск' }],
    tone: 'docs',
  };

  if (first === 'logistics' || first === 'driver' || first === 'elevator' || first === 'lab' || first === 'surveyor' || first === 'field') return {
    title: 'Исполнение',
    primary: { label: first === 'driver' ? 'Маршрут' : first === 'elevator' ? 'Приёмка' : first === 'lab' ? 'Качество' : 'Рейс', href: first === 'driver' ? '/platform-v7/driver' : first === 'elevator' ? '/platform-v7/elevator' : first === 'lab' ? '/platform-v7/lab' : '/platform-v7/logistics', tone: 'logistics' },
    actions: [{ label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' }, { label: 'Проблема', href: '/platform-v7/disputes', tone: 'risk' }],
    facts: [{ label: 'объект', value: 'рейс' }, { label: 'факт', value: 'подтверждение' }, { label: 'связь', value: 'сделка' }],
    tone: 'logistics',
  };

  if (first === 'seller') return {
    title: 'Продавец',
    primary: { label: 'Предложения', href: '/platform-v7/seller/offers', tone: 'money' },
    actions: [{ label: 'Партии', href: '/platform-v7/seller/lots' }, { label: 'Отгрузки', href: '/platform-v7/seller/batches', tone: 'logistics' }, { label: 'Документы', href: '/platform-v7/documents', tone: 'docs' }],
    facts: [{ label: 'фокус', value: 'документы' }, { label: 'риск', value: 'спор' }, { label: 'дальше', value: 'банк' }],
    tone: 'money',
  };

  if (first === 'buyer' || first === 'procurement' || first === 'proposals') return {
    title: 'Покупатель',
    primary: { label: 'Создать запрос', href: '/platform-v7/buyer/rfq', tone: 'money' },
    actions: [{ label: 'Предложения', href: '/platform-v7/proposals' }, { label: 'Сделки', href: '/platform-v7/deals' }, { label: 'Деньги', href: '/platform-v7/money', tone: 'money' }],
    facts: [{ label: 'фокус', value: 'качество' }, { label: 'дальше', value: 'сделка' }, { label: 'риск', value: 'приёмка' }],
    tone: 'money',
  };

  return {
    title: 'Работа',
    primary: { label: 'Сделки', href: '/platform-v7/deals' },
    actions: [{ label: 'Центр', href: '/platform-v7/control-tower', tone: 'risk' }, { label: 'Банк', href: '/platform-v7/bank', tone: 'money' }, { label: 'Разбор', href: `/platform-v7/ai?from=${encodeURIComponent(pathname)}` }],
    facts: [{ label: 'контур', value: 'сделка' }, { label: 'дальше', value: 'действие' }, { label: 'след', value: 'журнал' }],
    tone: 'neutral',
  };
}

export function WorkStepGuide() {
  const pathname = normalize(usePathname());
  const config = configFor(pathname);
  if (!config) return null;

  const Icon = iconFor(config.tone);
  const tone = toneMap[config.tone];

  return (
    <nav className={styles.root} data-testid="platform-v7-work-step-guide" aria-label="Рабочие действия" style={{ border: `1px solid ${tone.border}`, borderRadius: 18, background: '#fff', boxShadow: 'var(--pc-shadow-sm)', padding: 10, display: 'grid', gap: 8, maxWidth: '100%', overflow: 'hidden' }}>
      <div className={`p7-work-actions-row ${styles.row}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 180px) minmax(0, auto) minmax(160px, 1fr)', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0, color: tone.text, fontSize: 12, fontWeight: 900 }}>
          <span style={{ width: 30, height: 30, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tone.bg, border: `1px solid ${tone.border}`, color: tone.icon, flex: '0 0 auto' }}><Icon size={15} strokeWidth={2.3} /></span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.title}</span>
        </div>
        <Link href={config.primary.href} style={linkStyle(config.primary.tone ?? config.tone, true)}>{config.primary.label}<ArrowRight size={14} strokeWidth={2.2} /></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {config.actions.map((action) => <Link key={`${action.label}-${action.href}`} href={action.href} style={linkStyle(action.tone ?? 'neutral')}>{action.label}</Link>)}
          {config.facts.map((item) => <span key={`${item.label}-${item.value}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 30, padding: '5px 8px', borderRadius: 999, background: 'var(--pc-shell-surface-soft, #F8FAFB)', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 11, fontWeight: 780, whiteSpace: 'nowrap' }}><b style={{ color: 'var(--pc-text-muted, #64748B)', fontWeight: 850 }}>{item.label}</b>{item.value}</span>)}
        </div>
      </div>
    </nav>
  );
}
