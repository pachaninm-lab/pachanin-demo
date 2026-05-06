export const PLATFORM_V7_LEXICON = {
  nav: {
    controlTower: 'Центр управления',
    deals: 'Сделки',
    lots: 'Лоты и запросы',
    logistics: 'Логистика',
    analytics: 'Сводка',
    connectors: 'Подключения',
    bank: 'Банк',
    bankEvents: 'События банка',
    disputes: 'Споры',
    investor: 'Инвесторский обзор',
    demo: 'Проверочный сценарий',
    executionFlow: 'Путь сделки',
    trustCenter: 'Центр доверия',
    simulator: 'Проверочный сценарий',
    exportCenter: 'Выгрузки',
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
  },
  env: {
    pilot: 'Пилотный режим',
    pilotContour: 'Пилотный контур',
    sandbox: 'Тестовый контур',
    demo: 'Данные проверочного сценария',
    production: 'Промышленный контур требует подтверждения',
    field: 'Полевой режим',
    callbacks: 'Ответы банка',
    evidence: 'Доказательный контур',
    rules: 'Правила сделки',
    externalPending: 'Ожидает подтверждения внешней системы',
    manualReview: 'Ручная проверка',
  },
  actions: {
    openDeal: 'Открыть сделку',
    openDispute: 'Открыть спор',
    openBank: 'Открыть банковскую проверку',
    openDocuments: 'Открыть документы',
    openIntegrations: 'Открыть внешние подключения',
    showInvestor: 'Открыть инвесторский обзор',
    switchRole: 'Сменить роль',
    search: 'Поиск',
    close: 'Закрыть',
    retry: 'Повторить отправку',
    createLot: 'Создать лот',
    createDeal: 'Создать сделку',
    createDraft: 'Создать черновик',
    releaseFunds: 'Подтвердить выпуск денег',
    requestRelease: 'Запросить проверку выпуска',
    closeDispute: 'Закрыть спор по решению',
    openCommandPalette: 'Открыть поиск и команды',
    requestReserve: 'Запросить резерв',
  },
  breadcrumbs: {
    root: 'Прозрачная Цена',
    platformV7: 'Прозрачная Цена',
    controlTower: 'Центр управления',
    deals: 'Сделки',
    lots: 'Лоты и запросы',
    create: 'Создание',
    buyer: 'Покупатель',
    seller: 'Продавец',
    logistics: 'Логистика',
    field: 'Поле и приёмка',
    bank: 'Банк',
    events: 'События',
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
    connectors: 'Подключения',
    investor: 'Инвестор',
    demo: 'Проверка',
    executionFlow: 'Путь сделки',
    trust: 'Центр доверия',
    simulator: 'Проверка',
    exportCenter: 'Выгрузки',
    market: 'Лоты и запросы',
    notifications: 'Уведомления',
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
