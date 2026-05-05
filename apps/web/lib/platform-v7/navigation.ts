import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_LEXICON, platformV7EnvLabel } from './lexicon';

export type PlatformV7StageTone = 'pilot' | 'demo' | 'field';
export type PlatformV7SectionKey = 'dashboard' | 'deals' | 'lots' | 'create' | 'logistics' | 'analytics' | 'integrations' | 'bank' | 'disputes' | 'cabinet' | 'procurement' | 'receiving' | 'lab' | 'investor' | 'demo' | 'roles';
export interface PlatformV7NavItem { href: string; label: string; icon: PlatformV7SectionKey }

export const PLATFORM_V7_ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборатория', bank: 'Банк', arbitrator: 'Арбитр', compliance: 'Комплаенс', executive: 'Руководитель',
};

const pilot = { label: platformV7EnvLabel('pilot'), tone: 'pilot' as const };
const field = { label: platformV7EnvLabel('field'), tone: 'field' as const };

export const PLATFORM_V7_ROLE_STAGE: Record<PlatformRole, { label: string; tone: PlatformV7StageTone }> = {
  operator: pilot, buyer: pilot, seller: pilot, logistics: pilot, driver: field, surveyor: field, elevator: field, lab: field,
  bank: { label: platformV7EnvLabel('callbacks'), tone: 'demo' }, arbitrator: { label: platformV7EnvLabel('evidence'), tone: 'demo' }, compliance: { label: platformV7EnvLabel('rules'), tone: 'demo' }, executive: pilot,
};

export const PLATFORM_V7_ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower', buyer: '/platform-v7/buyer', seller: '/platform-v7/seller', logistics: '/platform-v7/logistics', driver: '/platform-v7/driver', surveyor: '/platform-v7/surveyor', elevator: '/platform-v7/elevator', lab: '/platform-v7/lab', bank: '/platform-v7/bank', arbitrator: '/platform-v7/arbitrator', compliance: '/platform-v7/compliance', executive: '/platform-v7/executive',
};

export const PLATFORM_V7_NAV_BY_ROLE: Record<PlatformRole, PlatformV7NavItem[]> = {
  operator: [
    { href: '/platform-v7/control-tower', label: PLATFORM_V7_LEXICON.nav.controlTower, icon: 'dashboard' },
    { href: '/platform-v7/batches', label: 'Партии зерна', icon: 'lots' },
    { href: '/platform-v7/buyer/rfq', label: 'RFQ / закупки', icon: 'procurement' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals, icon: 'deals' },
    { href: '/platform-v7/deals/grain-release', label: 'Деньги и удержания', icon: 'bank' },
    { href: '/platform-v7/deals/grain-sdiz', label: 'СДИЗ и документы', icon: 'integrations' },
    { href: '/platform-v7/logistics', label: PLATFORM_V7_LEXICON.nav.logistics, icon: 'logistics' },
    { href: '/platform-v7/elevator/terminal', label: 'Элеваторный терминал', icon: 'receiving' },
    { href: '/platform-v7/executive', label: PLATFORM_V7_LEXICON.nav.analytics, icon: 'analytics' },
    { href: '/platform-v7/connectors', label: PLATFORM_V7_LEXICON.nav.connectors, icon: 'integrations' },
    { href: '/platform-v7/bank', label: PLATFORM_V7_LEXICON.nav.bank, icon: 'bank' },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes, icon: 'disputes' },
    { href: '/platform-v7/demo/grain-execution', label: 'Демо-цепочка', icon: 'demo' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: PLATFORM_V7_LEXICON.nav.cabinet, icon: 'cabinet' },
    { href: '/platform-v7/buyer/rfq', label: 'Закупочные запросы', icon: 'procurement' },
    { href: '/platform-v7/procurement', label: PLATFORM_V7_LEXICON.nav.procurement, icon: 'procurement' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals, icon: 'deals' },
    { href: '/platform-v7/deals/grain-quality', label: 'Качество и приёмка', icon: 'receiving' },
    { href: '/platform-v7/bank', label: PLATFORM_V7_LEXICON.nav.money, icon: 'bank' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: PLATFORM_V7_LEXICON.nav.cabinet, icon: 'cabinet' },
    { href: '/platform-v7/batches', label: 'Партии зерна', icon: 'lots' },
    { href: '/platform-v7/seller/quick-sale', label: 'Быстрая продажа', icon: 'create' },
    { href: '/platform-v7/lots', label: PLATFORM_V7_LEXICON.nav.lots, icon: 'lots' },
    { href: '/platform-v7/lots/create', label: PLATFORM_V7_LEXICON.nav.createLot, icon: 'create' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals, icon: 'deals' },
    { href: '/platform-v7/deals/grain-release', label: 'Деньги и удержания', icon: 'bank' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', icon: 'logistics' },
    { href: '/platform-v7/driver', label: PLATFORM_V7_LEXICON.nav.driver, icon: 'cabinet' },
    { href: '/platform-v7/elevator/terminal', label: 'Элеваторный терминал', icon: 'receiving' },
    { href: '/platform-v7/elevator', label: PLATFORM_V7_LEXICON.nav.receiving, icon: 'receiving' },
    { href: '/platform-v7/lab', label: PLATFORM_V7_LEXICON.nav.lab, icon: 'lab' },
  ],
  driver: [{ href: '/platform-v7/driver', label: 'Маршрут', icon: 'logistics' }],
  surveyor: [{ href: '/platform-v7/surveyor', label: 'Назначения', icon: 'cabinet' }],
  elevator: [
    { href: '/platform-v7/elevator/terminal', label: 'Терминал приёмки', icon: 'receiving' },
    { href: '/platform-v7/elevator', label: PLATFORM_V7_LEXICON.nav.receiving, icon: 'receiving' },
  ],
  lab: [{ href: '/platform-v7/lab', label: 'Пробы', icon: 'lab' }, { href: '/platform-v7/deals/grain-quality', label: 'Качество', icon: 'lab' }],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковый контур', icon: 'bank' },
    { href: '/platform-v7/deals/grain-release', label: 'Основания выпуска', icon: 'bank' },
    { href: '/platform-v7/deals/grain-sdiz', label: 'СДИЗ / документы', icon: 'integrations' },
    { href: '/platform-v7/bank/factoring', label: PLATFORM_V7_LEXICON.nav.factoring, icon: 'bank' },
    { href: '/platform-v7/bank/escrow', label: PLATFORM_V7_LEXICON.nav.escrow, icon: 'bank' },
    { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals, icon: 'deals' },
    { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.holds, icon: 'disputes' },
  ],
  arbitrator: [{ href: '/platform-v7/arbitrator', label: 'Разбор', icon: 'analytics' }, { href: '/platform-v7/disputes', label: PLATFORM_V7_LEXICON.nav.disputes, icon: 'disputes' }, { href: '/platform-v7/deals/grain-quality', label: 'Качество и доказательства', icon: 'lab' }],
  compliance: [{ href: '/platform-v7/compliance', label: 'Допуск', icon: 'cabinet' }, { href: '/platform-v7/deals', label: PLATFORM_V7_LEXICON.nav.deals, icon: 'deals' }, { href: '/platform-v7/deals/grain-sdiz', label: 'СДИЗ / документы', icon: 'integrations' }],
  executive: [{ href: '/platform-v7/executive', label: PLATFORM_V7_LEXICON.nav.executive, icon: 'analytics' }, { href: '/platform-v7/control-tower', label: PLATFORM_V7_LEXICON.nav.controlTower, icon: 'dashboard' }, { href: '/platform-v7/demo/grain-execution', label: 'Демо-цепочка', icon: 'demo' }, { href: '/platform-v7/bank', label: PLATFORM_V7_LEXICON.nav.money, icon: 'bank' }],
};

export function platformV7RoleLabel(role: PlatformRole): string { return PLATFORM_V7_ROLE_LABELS[role]; }
export function platformV7RoleRoute(role: PlatformRole): string { return PLATFORM_V7_ROLE_ROUTES[role]; }
export function platformV7RoleStage(role: PlatformRole): { label: string; tone: PlatformV7StageTone } { return PLATFORM_V7_ROLE_STAGE[role]; }
export function platformV7NavItems(role: PlatformRole): PlatformV7NavItem[] { return PLATFORM_V7_NAV_BY_ROLE[role]; }
