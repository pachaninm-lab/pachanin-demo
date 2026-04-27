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
    cabinet: 'Кабинет',
    createLot: 'Создать лот',
    receiving: 'Приёмка',
    surveyor: 'Сюрвейер',
    arbitrator: 'Арбитр',
    executive: 'Сводка',
    money: 'Деньги',
    holds: 'Удержания',
    factoring: 'Факторинг',
    escrow: 'Эскроу',
    fgisParties: 'Партии ФГИС',
    financing: 'Финансирование',
    market: 'Рынок',
  },
  env: {
    pilot: 'Пилотный режим',
    sandbox: 'Тестовая среда',
    demo: 'Демо-данные',
    production: 'Боевой контур',
    field: 'Полевой режим',
    callbacks: 'События банка',
    evidence: 'Доказательства',
    rules: 'Правила допуска',
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
    createLot: 'Создать лот',
    createDeal: 'Создать сделку',
    createDraft: 'Создать черновик',
    releaseFunds: 'Выпустить деньги',
    requestRelease: 'Запросить выпуск денег',
    closeDispute: 'Закрыть спор',
    openCommandPalette: 'Открыть поиск и команды',
  },
  breadcrumbs: {
    root: 'Прозрачная Цена',
    platformV7: 'Прозрачная Цена',
    controlTower: 'Центр управления',
    deals: 'Сделки',
    lots: 'Лоты',
    create: 'Создание',
    buyer: 'Покупатель',
    seller: 'Продавец',
    logistics: 'Логистика',
    field: 'Поле и приёмка',
    bank: 'Банк',
    disputes: 'Споры',
    compliance: 'Комплаенс',
    analytics: 'Сводка',
    executive: 'Сводка',
    procurement: 'Закупки',
    driver: 'Водитель',
    surveyor: 'Сюрвейер',
    elevator: 'Элеватор',
    lab: 'Лаборатория',
    arbitrator: 'Арбитр',
    connectors: 'Интеграции',
    investor: 'Инвестор',
    demo: 'Демо',
    market: 'Рынок',
    notifications: 'Уведомления',
    fgisParties: 'Партии ФГИС',
    financing: 'Финансирование',
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

export function platformV7EnvLabel(key: keyof PlatformV7Lexicon['env']): string {
  return PLATFORM_V7_LEXICON.env[key];
}

export function platformV7BreadcrumbLabel(key: keyof PlatformV7Lexicon['breadcrumbs']): string {
  return PLATFORM_V7_LEXICON.breadcrumbs[key];
}
