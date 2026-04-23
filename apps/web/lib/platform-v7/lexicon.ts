export const PLATFORM_V7_LEXICON = {
  nav: {
    controlTower: 'Центр управления',
    deals: 'Сделки',
    lots: 'Лоты',
    logistics: 'Логистика',
    analytics: 'Аналитика',
    connectors: 'Интеграции',
    bank: 'Банк',
    disputes: 'Споры',
    investor: 'Инвестор-режим',
    demo: 'Демо',
    roles: 'Все роли',
    documents: 'Документы',
    procurement: 'Закупки',
    driver: 'Водитель',
    elevator: 'Элеватор',
    lab: 'Лаборатория',
    compliance: 'Комплаенс',
    profile: 'Профиль',
    notifications: 'Уведомления',
  },
  env: {
    pilot: 'Пилотный режим',
    sandbox: 'Тестовая среда',
    demo: 'Демо-данные',
    production: 'Боевой контур',
  },
  actions: {
    openDeal: 'Открыть сделку',
    openDispute: 'Открыть спор',
    openBank: 'Открыть банк',
    openDocuments: 'Открыть документы',
    openIntegrations: 'Открыть интеграции',
    showInvestor: 'Показать инвестору',
    switchRole: 'Сменить роль',
    search: 'Поиск',
    close: 'Закрыть',
    retry: 'Повторить',
  },
  statuses: {
    pass: 'Пройдено',
    review: 'Проверка',
    fail: 'Стоп',
    pending: 'Ожидает',
    ready: 'Готово',
  },
} as const;

export type PlatformV7Lexicon = typeof PLATFORM_V7_LEXICON;

export function platformV7NavLabel(key: keyof PlatformV7Lexicon['nav']): string {
  return PLATFORM_V7_LEXICON.nav[key];
}

export function platformV7ActionLabel(key: keyof PlatformV7Lexicon['actions']): string {
  return PLATFORM_V7_LEXICON.actions[key];
}
