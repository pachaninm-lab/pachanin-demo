const fullyLiveClaim = ['fully', 'live'].join(' ');
const fullyLiveHyphenClaim = ['fully', 'live'].join('-');
const fullyIntegratedClaim = ['fully', 'integrated'].join(' ');
const fullyIntegratedHyphenClaim = ['fully', 'integrated'].join('-');
const guaranteedPaymentClaim = ['guaranteed', 'payment'].join(' ');
const selfReleaseClaim = ['platform', 'releases', 'money', 'itself'].join(' ');
const noRisksClaim = ['no', 'risks'].join(' ');
const bestWorldClaim = ['best', 'in', 'the', 'world'].join(' ');
const noAnaloguesClaim = ['no', 'analogues'].join(' ');

export const PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY = [
  'Control Tower',
  'Controlled pilot',
  'controlled-pilot',
  'Simulation-grade',
  'simulation-grade',
  'simulation-only',
  'Sandbox',
  'sandbox',
  'callbacks',
  'callback',
  'evidence-first',
  'runtime',
  'guardBlocked',
  'stateTransition',
  'Action handoff',
  'requestReserve',
  'confirmReserve',
  'assignDriver',
  'publishLot',
  'production-ready',
  fullyLiveClaim,
  fullyLiveHyphenClaim,
  fullyIntegratedClaim,
  fullyIntegratedHyphenClaim,
  'live-integrated',
  guaranteedPaymentClaim,
  selfReleaseClaim,
  noRisksClaim,
  bestWorldClaim,
  noAnaloguesClaim,
  'mock',
  'debug',
  'test user',
  'Deal 360',
  'Executive view',
  'executive-view',
  'внешний-safe',
  'stop-факторы',
  'Маршрут сделки за 3 минуты',
  'Ответы за 5 секунд',
  'выше первого скролла',
  'маршрут показа',
  'сквозной сценарий',
  'первый экран',
] as const;

export const PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS: Readonly<Record<string, string>> = {
  'Control Tower': 'Центр управления',
  'Controlled pilot': 'Контур сделки',
  'controlled-pilot': 'контур сделки',
  'Controlled-pilot': 'Контур сделки',
  'Пилотный режим': 'Контур сделки',
  'Simulation-grade': 'Проверочный контур',
  'simulation-grade': 'проверочный контур',
  'simulation-only': 'проверочный контур',
  Sandbox: 'Проверочный контур',
  sandbox: 'проверочный контур',
  'Тестовая среда': 'Проверочный контур',
  callbacks: 'ответы банка',
  callback: 'ответ банка',
  'evidence-first': 'доказательный контур',
  runtime: 'контур исполнения',
  guardBlocked: 'действие остановлено',
  stateTransition: 'статус изменён',
  'Action handoff': 'передача следующего действия',
  requestReserve: 'запросить резерв',
  confirmReserve: 'подтвердить резерв',
  assignDriver: 'назначить водителя',
  publishLot: 'опубликовать лот',
  'production-ready': 'требует подтверждения в промышленной эксплуатации',
  'не production-ready': 'требует подтверждения в промышленной эксплуатации',
  [fullyLiveClaim]: 'требует боевого подтверждения',
  [fullyLiveHyphenClaim]: 'требует боевого подтверждения',
  [fullyIntegratedClaim]: 'требует подключённых внешних систем',
  [fullyIntegratedHyphenClaim]: 'требует подключённых внешних систем',
  'live-integrated': 'требует боевого подключения',
  [guaranteedPaymentClaim]: 'платёж зависит от подтверждений банка и условий сделки',
  [selfReleaseClaim]: 'выпуск денег требует подтверждения банка',
  [noRisksClaim]: 'риски требуют контроля и проверки',
  [bestWorldClaim]: 'требует подтверждения метриками и пилотами',
  [noAnaloguesClaim]: 'требует подтверждения сравнением и пилотами',
  mock: 'проверочные данные',
  debug: 'служебная проверка',
  'test user': 'проверочная роль',
  'Deal 360': 'карточка сделки',
  'Executive view': 'управленческая сводка',
  'executive-view': 'управленческая сводка',
  'внешний-safe': 'рабочий',
  'stop-факторы': 'причины остановки',

  'Маршрут сделки за 3 минуты': 'Рабочий контур сделки',
  'Ответы за 5 секунд': 'Состояние сделки',
  'Деньги, груз, документы, блокер и следующий ответственный — выше первого скролла': 'Деньги, груз, документы, блокер и следующий ответственный',
  'выше первого скролла': 'в сводке сделки',
  'маршрут показа': 'рабочий маршрут',
  'сквозной сценарий': 'текущий контур',
  'первый экран': 'сводка',
  'Одна сделка, девять рабочих поверхностей': 'Рабочие разделы сделки',
  'Путь ведёт пользователя по исполнению сделки, а не по меню. Каждый шаг показывает: что видит роль, что скрыто и почему выпуск денег не происходит без доказательств.':
    'Разделы показывают участок ответственности, ограничения доступа и влияние на выпуск денег.',
  'Одинаково понятная платформа, но не одинаковая для всех': 'Доступ по ролям',
  'У каждой роли свой безопасный контур. Чем меньше лишнего видит роль, тем выше доверие к деньгам, документам и спору.':
    'Каждая роль видит свой участок сделки, документы, деньги и следующие действия.',
  'Главная страница показывает не «одинаковую платформу для всех», а один понятный контур исполнения: продавец → Deal 360 → банк → документы → логистика → водитель → приёмка → спор → оператор.':
    'Рабочий маршрут показывает лот, сделку, деньги, документы, рейс, приёмку, спор и следующий ответственный шаг.',
  'Показ ведётся по одной сделке от цены до доказательств, а не по случайному набору экранов.':
    'Сводка собрана по одной сделке: цена, документы, рейс, деньги и доказательства.',
  'Не фальшивой кнопки выплаты': 'Без выпуска денег',
  'Нет фальшивой кнопки выплаты': 'Нет выпуска денег',
  'Демо': 'Проверка',
  'демо': 'проверка',
  'showcase': 'рабочий контур',
  'exhibition': 'рабочий контур',
};

export const PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES = [
  'пользователь видит официальный русский язык',
  'роль видит только нужный ей контекст',
  'статус зрелости не завышается',
  'технические следы скрыты из внешнего контура',
  'кнопки описывают деловое действие, а не внутреннюю команду',
  'деньги, документы, груз и блокер названы одинаково на всех экранах',
  'интерфейс выглядит как рабочая система, а не презентационный стенд',
] as const;

export function getPlatformV7ExternalReplacement(copy: string): string | undefined {
  return PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS[copy];
}
