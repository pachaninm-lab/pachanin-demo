'use client';

import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';

const ROLE_COPY: Record<Locale, Record<string, string>> = {
  ru: {
    buyer: 'Показывает блокеры приёмки, качества и расчёта',
    seller: 'Проверяет готовность партии, отгрузку, документы и оплату',
    logistics: 'Выявляет задержки, простои и нарушение временных окон',
    driver: 'Сверяет маршрут, документы, точку и время приёмки',
    elevator: 'Контролирует очередь, массу, приёмку и расхождения',
    laboratory: 'Сопоставляет пробы, показатели, нормы и протокол',
    lab: 'Сопоставляет пробы, показатели, нормы и протокол',
    bank: 'Проверяет комплектность оснований и финансовые риски',
    compliance: 'Объясняет полномочия, нарушения и применимый регламент',
    arbitrator: 'Собирает хронологию, доказательства и позиции сторон',
    executive: 'Показывает деньги под риском, просрочки и точки вмешательства',
    operator: 'Показывает системные блокеры, инциденты и контрольные действия',
    surveyor: 'Сверяет независимые измерения, акты и доказательства',
  },
  en: {
    buyer: 'Shows acceptance, quality, and settlement blockers',
    seller: 'Checks lot readiness, shipment, documents, and payment',
    logistics: 'Detects delays, waiting time, and missed windows',
    driver: 'Reconciles route, documents, place, and acceptance time',
    elevator: 'Controls queue, weight, acceptance, and discrepancies',
    laboratory: 'Compares samples, indicators, standards, and report',
    lab: 'Compares samples, indicators, standards, and report',
    bank: 'Checks payment grounds and financial risk',
    compliance: 'Explains authority, violations, and applicable procedure',
    arbitrator: 'Builds chronology, evidence, and party positions',
    executive: 'Shows money at risk, overdue work, and intervention points',
    operator: 'Shows systemic blockers, incidents, and control actions',
    surveyor: 'Reconciles independent measurements, acts, and evidence',
  },
  zh: {
    buyer: '显示验收、质量和结算阻塞项',
    seller: '检查货物准备、发运、文件和付款',
    logistics: '发现延误、等待和时间窗口问题',
    driver: '核对路线、文件、地点和验收时间',
    elevator: '控制排队、重量、验收和差异',
    laboratory: '比对样本、指标、标准和报告',
    lab: '比对样本、指标、标准和报告',
    bank: '检查付款依据和金融风险',
    compliance: '说明权限、违规和适用流程',
    arbitrator: '汇总时间线、证据和双方立场',
    executive: '显示风险资金、逾期事项和干预点',
    operator: '显示系统阻塞、事件和控制操作',
    surveyor: '核对独立测量、记录和证据',
  },
};

export function PublicRoleIntelligenceSummary({ perspective, locale }: { perspective: string; locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const text = ROLE_COPY[localeKey][perspective] || ROLE_COPY[localeKey].operator;

  return (
    <span
      className='pc-public-role-intelligence'
      onClick={() => trackEvent('role_intelligence_opened', { role: perspective, locale: localeKey, source: 'home_role_card' })}
    >
      <b><Sparkles size={13} aria-hidden='true' />TAI</b>
      <small>{text} →</small>
    </span>
  );
}
