// M3-8: единый справочник ролевых кабинетов (фронт-дор «Выберите свою роль»).
// Используется витриной входа и ролевым пультом. Вход сейчас открыт во все ЛК
// (pre-integration, без боевого гейтинга доступа).

export type PlatformV7RoleGroup = 'Основные участники' | 'Исполнение' | 'Контроль и управление';

export type PlatformV7RoleDirectoryItem = {
  readonly title: string;
  readonly focus: string;
  readonly href: string;
  readonly group: PlatformV7RoleGroup;
  readonly tone: string;
  readonly surface: string;
  readonly fieldMode: boolean;
};

export const PLATFORM_V7_ROLE_DIRECTORY: readonly PlatformV7RoleDirectoryItem[] = [
  // Основные участники
  { title: 'Продавец', focus: 'Партия, СДИЗ, документы, отгрузка, получение денег.', href: '/platform-v7/seller', group: 'Основные участники', tone: '#0A7A5F', surface: '#ECFDF5', fieldMode: false },
  { title: 'Покупатель', focus: 'Запрос, оффер, резерв, качество, приёмка, документы.', href: '/platform-v7/buyer', group: 'Основные участники', tone: '#2563EB', surface: '#EFF6FF', fieldMode: false },
  // Исполнение
  { title: 'Логистика', focus: 'Рейс, водитель, маршрут, пломба, события пути.', href: '/platform-v7/logistics', group: 'Исполнение', tone: '#7C3AED', surface: '#F5F3FF', fieldMode: false },
  { title: 'Водитель', focus: 'Один текущий рейс и одно следующее действие.', href: '/platform-v7/driver/field', group: 'Исполнение', tone: '#475569', surface: '#F8FAFC', fieldMode: true },
  { title: 'Элеватор', focus: 'Приёмка, вес, акт расхождения, основание для денег.', href: '/platform-v7/elevator', group: 'Исполнение', tone: '#B45309', surface: '#FFFBEB', fieldMode: true },
  { title: 'Лаборатория', focus: 'Проба, протокол качества, отклонение и влияние.', href: '/platform-v7/lab', group: 'Исполнение', tone: '#0369A1', surface: '#F0F9FF', fieldMode: true },
  { title: 'Сюрвейер', focus: 'Осмотр, фото, расхождение, заключение.', href: '/platform-v7/surveyor', group: 'Исполнение', tone: '#0E9384', surface: '#ECFEFF', fieldMode: true },
  // Контроль и управление
  { title: 'Банк', focus: 'Резерв, удержание, ручная проверка, основание выплаты.', href: '/platform-v7/bank', group: 'Контроль и управление', tone: '#0F172A', surface: '#F8FAFC', fieldMode: false },
  { title: 'Оператор', focus: 'Очередь блокеров и следующее действие.', href: '/platform-v7/operator', group: 'Контроль и управление', tone: '#4F46E5', surface: '#EEF2FF', fieldMode: false },
  { title: 'Руководитель', focus: 'Деньги под риском, узкие места, зрелость пилота.', href: '/platform-v7/executive', group: 'Контроль и управление', tone: '#111827', surface: '#F3F4F6', fieldMode: false },
  { title: 'Арбитр', focus: 'Спор, доказательства, решение по деньгам.', href: '/platform-v7/arbitrator', group: 'Контроль и управление', tone: '#B42318', surface: '#FEF2F2', fieldMode: false },
  { title: 'Комплаенс', focus: 'KYC/AML проверка, риск, блокер сделки.', href: '/platform-v7/compliance', group: 'Контроль и управление', tone: '#9333EA', surface: '#FAF5FF', fieldMode: false },
];

export const PLATFORM_V7_ROLE_GROUPS: readonly PlatformV7RoleGroup[] = [
  'Основные участники',
  'Исполнение',
  'Контроль и управление',
];

export function platformV7RolesByGroup(group: PlatformV7RoleGroup): readonly PlatformV7RoleDirectoryItem[] {
  return PLATFORM_V7_ROLE_DIRECTORY.filter((role) => role.group === group);
}
