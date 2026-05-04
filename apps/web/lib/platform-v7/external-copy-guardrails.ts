export const PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY = [
  'Control Tower',
  'Controlled pilot',
  'Simulation-grade',
  'simulation-only',
  'Sandbox',
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
  'live-integrated',
  'mock',
  'debug',
  'test user',
] as const;

export const PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS: Readonly<Record<string, string>> = {
  'Control Tower': 'Центр управления',
  'Controlled pilot': 'Пилотный режим',
  'Simulation-grade': 'Тестовый сценарий сделки',
  'simulation-only': 'тестовый контур',
  Sandbox: 'Тестовая среда',
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
  'live-integrated': 'требует боевого подключения',
  mock: 'тестовые данные',
  debug: 'служебная проверка',
  'test user': 'тестовая роль',
};

export const PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES = [
  'пользователь видит официальный русский язык',
  'роль видит только нужный ей контекст',
  'статус зрелости не завышается',
  'технические следы скрыты из внешнего контура',
  'кнопки описывают деловое действие, а не внутреннюю команду',
  'деньги, документы, груз и блокер названы одинаково на всех экранах',
] as const;

export function getPlatformV7ExternalReplacement(copy: string): string | undefined {
  return PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS[copy];
}
