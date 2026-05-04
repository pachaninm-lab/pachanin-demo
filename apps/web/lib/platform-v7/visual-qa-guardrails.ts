export type PlatformV7QaPriority = 'P0' | 'P1' | 'P2';

export type PlatformV7ViewportKey =
  | 'android360'
  | 'iphoneSe375'
  | 'iphone14ProMax430'
  | 'ipad768'
  | 'ipadLandscape1024'
  | 'desktop1280'
  | 'desktop1366'
  | 'desktop1440'
  | 'desktop1728'
  | 'desktop1920'
  | 'desktop2560';

export const PLATFORM_V7_QA_VIEWPORTS: Readonly<Record<PlatformV7ViewportKey, { width: number; label: string }>> = {
  android360: { width: 360, label: 'Android 360' },
  iphoneSe375: { width: 375, label: 'iPhone SE' },
  iphone14ProMax430: { width: 430, label: 'iPhone 14 Pro Max' },
  ipad768: { width: 768, label: 'iPad портрет' },
  ipadLandscape1024: { width: 1024, label: 'iPad альбом' },
  desktop1280: { width: 1280, label: 'Экран 1280' },
  desktop1366: { width: 1366, label: 'Экран 1366' },
  desktop1440: { width: 1440, label: 'Экран 1440' },
  desktop1728: { width: 1728, label: 'Экран 1728' },
  desktop1920: { width: 1920, label: 'Экран 1920' },
  desktop2560: { width: 2560, label: 'Экран 2560' },
} as const;

export type PlatformV7VisualQaRoute = {
  readonly path: string;
  readonly group: 'core' | 'extended' | 'system' | 'canonical';
  readonly priority: PlatformV7QaPriority;
  readonly expectedSurface: string;
  readonly mustAnswer: readonly string[];
};

export const PLATFORM_V7_EXHIBITION_ACCEPTANCE = [
  'единая визуальная система на всех экранах',
  'понятность роли за 5 секунд',
  'отсутствие визуального шума',
  'безупречная мобильная версия без горизонтальной прокрутки',
  'полноценный светлый и тёмный режим без светлых пятен',
  'сильные состояния пусто, ошибка и загрузка',
  'мягкая реакция интерфейса на действие',
  'русский официальный язык без англицизмов и следов разработки',
  'банковская строгость и премиальный B2B-уровень',
  'честный статус controlled pilot без заявлений о боевой готовности',
] as const;

export const PLATFORM_V7_VISUAL_QA_ROUTES: readonly PlatformV7VisualQaRoute[] = [
  {
    path: '/platform-v7',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'премиальный центр управления исполнением сделки, не маркетплейс',
    mustAnswer: ['что происходит сейчас', 'цепочка сделки', 'деньги', 'груз', 'документы', 'блокер', 'следующее действие'],
  },
  {
    path: '/platform-v7/seller',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'кабинет продавца: лот, предложение, документы, деньги',
    mustAnswer: ['мой лот', 'принятое предложение', 'почему деньги не выпущены', 'документы', 'следующий ответственный', 'лишние банковые данные скрыты'],
  },
  {
    path: '/platform-v7/buyer',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'кабинет покупателя: ставка, резерв, качество, следующий шаг',
    mustAnswer: ['моя ставка', 'мой резерв', 'условия оплаты', 'чужие закрытые ставки скрыты', 'следующее действие'],
  },
  {
    path: '/platform-v7/logistics',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'диспетчерская исполнения рейса',
    mustAnswer: ['заявка после выбора победителя', 'машина', 'водитель', 'время прибытия', 'транспортные документы', 'цена зерна и банк скрыты'],
  },
  {
    path: '/platform-v7/logistics/inbox',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'входящие заявки логистики',
    mustAnswer: ['новая заявка', 'маршрут', 'водитель', 'время прибытия', 'следующее действие', 'банковый резерв скрыт'],
  },
  {
    path: '/platform-v7/driver',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'мобильный кабинет водителя',
    mustAnswer: ['один рейс', 'карта', 'время прибытия', 'фото', 'пломба', 'очередь без связи', 'деньги скрыты'],
  },
  {
    path: '/platform-v7/elevator',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'приёмка, вес и подтверждение факта',
    mustAnswer: ['вес', 'качество', 'акт приёмки', 'отклонение', 'влияние на расчёт', 'ставки и банк скрыты'],
  },
  {
    path: '/platform-v7/bank',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'банковый контроль денег и оснований выпуска',
    mustAnswer: ['резерв', 'кандидат к выпуску', 'удержание', 'блокеры', 'документы', 'без фальшивого выпуска денег'],
  },
  {
    path: '/platform-v7/documents',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'ворота документов перед выпуском денег',
    mustAnswer: ['источник', 'ответственный', 'статус', 'подпись', 'влияние на выпуск денег', 'не архив файлов'],
  },
  {
    path: '/platform-v7/disputes',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'спор, доказательства и денежное влияние',
    mustAnswer: ['причина', 'сумма влияния', 'срок реакции', 'доказательства', 'ответственный', 'следующее действие'],
  },
  {
    path: '/platform-v7/connectors',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'предпилотные подключения без завышения зрелости',
    mustAnswer: ['тестовый контур', 'требуются доступы', 'нет заявления о боевой интеграции', 'затронутые экраны', 'режим деградации'],
  },
  {
    path: '/platform-v7/deals/DL-9106/clean',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'чистая карточка сделки 360',
    mustAnswer: ['деньги', 'груз', 'документы', 'спор', 'блокер', 'следующий ответственный'],
  },
  {
    path: '/platform-v7/lots/LOT-2403',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'карточка лота, готовая к переходу в сделку',
    mustAnswer: ['паспорт лота', 'качество', 'документы', 'контекст ставки', 'переход в сделку', 'не доска объявлений'],
  },
  {
    path: '/platform-v7/control-tower',
    group: 'extended',
    priority: 'P0',
    expectedSurface: 'операторский центр управления',
    mustAnswer: ['очередь блокеров', 'денежное влияние', 'срок реакции', 'ответственный', 'журнал', 'без тихого ручного обхода'],
  },
  {
    path: '/platform-v7/lab',
    group: 'extended',
    priority: 'P1',
    expectedSurface: 'лабораторная поверхность доказательств',
    mustAnswer: ['проба', 'показатели качества', 'протокол', 'источник', 'влияние на спор', 'цена скрыта'],
  },
  {
    path: '/platform-v7/compliance',
    group: 'extended',
    priority: 'P1',
    expectedSurface: 'допуск, право и риск доступа',
    mustAnswer: ['риск', 'документ', 'основание', 'статус', 'действие', 'журнал'],
  },
  {
    path: '/platform-v7/demo',
    group: 'system',
    priority: 'P0',
    expectedSurface: 'трёхминутный управляемый маршрут исполнения сделки',
    mustAnswer: ['маршрут показа', 'LOT-2403', 'DL-9106', 'резерв', 'рейс', 'документы', 'деньги', 'спор'],
  },
  {
    path: '/platform-v7/deploy-check',
    group: 'system',
    priority: 'P1',
    expectedSurface: 'служебная проверка, не пользовательский экран',
    mustAnswer: ['не внешний экран', 'внутренняя проверка', 'возврат на платформу', 'статус сборки', 'без клиентского обещания'],
  },
];

export const PLATFORM_V7_VISUAL_QA_BLOCKERS = [
  'изменён apps/landing',
  'заявление о промышленной готовности или боевой интеграции без доказательства',
  'кнопка выпуска денег без условий безопасного выпуска',
  'роль видит запрещённые деньги, ставки, кредит или банковые данные',
  'горизонтальная прокрутка на мобильном экране',
  'закреплённый элемент перекрывает контент или фокус',
  'основное действие меньше 44px на сенсорных маршрутах',
  'таблица остаётся сжатой настольной таблицей на критичном мобильном маршруте',
  'неизвестный сломанный маршрут маскируется как рабочий экран',
  'служебная проверка выглядит как обычная пользовательская поверхность',
  'английский или технический текст виден во внешнем контуре',
  'тёмная тема содержит светлые карточки, бледный текст или нечитабельные бейджи',
] as const;

export function getPlatformV7P0QaRoutes(): readonly PlatformV7VisualQaRoute[] {
  return PLATFORM_V7_VISUAL_QA_ROUTES.filter((route) => route.priority === 'P0');
}

export function getPlatformV7MobileCriticalRoutes(): readonly string[] {
  return PLATFORM_V7_VISUAL_QA_ROUTES
    .filter((route) => route.group === 'core' || route.path === '/platform-v7/demo')
    .map((route) => route.path);
}
