export type GrainExecutionTheme = 'light' | 'dark';
export type GrainExecutionTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'money';

export type GrainExecutionRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'bank'
  | 'compliance'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'arbitrator'
  | 'executive';

export const GRAIN_EXECUTION_COCKPIT_THEME = {
  defaultTheme: 'light',
  explicitThemes: ['light', 'dark'],
} as const satisfies {
  readonly defaultTheme: GrainExecutionTheme;
  readonly explicitThemes: readonly GrainExecutionTheme[];
};

export const GRAIN_EXECUTION_ROLE_ORDER = [
  'seller',
  'buyer',
  'operator',
  'bank',
  'compliance',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'arbitrator',
  'executive',
] as const satisfies readonly GrainExecutionRole[];

export const GRAIN_EXECUTION_ROLE_LABELS: Record<GrainExecutionRole, string> = {
  seller: 'Продавец',
  buyer: 'Покупатель',
  operator: 'Оператор',
  bank: 'Банк',
  compliance: 'Комплаенс',
  logistics: 'Логистика',
  driver: 'Водитель',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  surveyor: 'Сюрвейер',
  arbitrator: 'Арбитр',
  executive: 'Руководитель',
};

export const GRAIN_EXECUTION_STATUS_TONES = {
  success: {
    label: 'готово',
    meaning: 'действие или проверка закрыты',
  },
  warning: {
    label: 'ожидает',
    meaning: 'нужна ручная проверка или внешний ответ',
  },
  danger: {
    label: 'стоп',
    meaning: 'деньги, груз или документы остановлены',
  },
  info: {
    label: 'проверка',
    meaning: 'информационный или review-сигнал',
  },
  money: {
    label: 'деньги',
    meaning: 'резерв, удержание или основание для банка',
  },
  neutral: {
    label: 'статус',
    meaning: 'нейтральное состояние',
  },
} as const satisfies Record<GrainExecutionTone, { readonly label: string; readonly meaning: string }>;

export const GRAIN_EXECUTION_CARD_GRAMMAR = [
  'title',
  'status',
  'shortFact',
  'blocker',
  'nextStep',
  'action',
] as const;

export const GRAIN_EXECUTION_ACTION_LABELS = [
  'Закрыть СДИЗ',
  'Запросить подтверждение резерва',
  'Передать основание банку',
  'Прикрепить протокол',
  'Зафиксировать вес',
  'Создать акт расхождения',
  'Собрать доказательства',
] as const;

export const GRAIN_EXECUTION_MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 375, height: 812 },
  { width: 360, height: 800 },
  { width: 812, height: 375 },
  { width: 1280, height: 720 },
] as const;
