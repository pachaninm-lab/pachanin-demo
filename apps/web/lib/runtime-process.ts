export type RuntimeStep = {
  code: string;
  title: string;
  owner: string;
  dependency?: string;
  evidence: string[];
  output: string;
  risk: string;
};

export type RoleMatrix = {
  id: string;
  role: string;
  before: string[];
  during: string[];
  after: string[];
  receivesFrom: string[];
  handsOffTo: string[];
  criticalEvidence: string[];
  mainAbuseRisk: string;
};

export const runtimeSteps: RuntimeStep[] = [
  { code: 'LOT_DRAFT', title: 'Лот создан', owner: 'Фермер', evidence: ['карточка лота', 'адрес', 'состояние дороги'], output: 'Черновик лота', risk: 'ложный объём / неточный базис' },
  { code: 'LOT_PUBLISHED', title: 'Лот опубликован', owner: 'Платформа', dependency: 'LOT_DRAFT', evidence: ['история изменений', 'правила торгов'], output: 'Лот в торгах', risk: 'некорректные условия торгов' },
  { code: 'BID_WON', title: 'Победитель выбран', owner: 'Продавец', dependency: 'LOT_PUBLISHED', evidence: ['сравнение ставок', 'журнал решения'], output: 'Решение по победителю', risk: 'выбор не по правилам / обход платформы' },
  { code: 'DEAL_ACTIVATED', title: 'Сделка активирована', owner: 'Менеджер сопровождения', dependency: 'BID_WON', evidence: ['гейты активации', 'запрос резерва'], output: 'Карточка сделки', risk: 'запуск сделки без полного зелёного статуса' },
  { code: 'DISPATCH_PACKET', title: 'Логзаявка собрана', owner: 'Логист', dependency: 'DEAL_ACTIVATED', evidence: ['точные адреса', 'окна', 'маршрут через весовую', 'требования к машине'], output: 'Логистический пакет', risk: 'неполная заявка и простой' },
  { code: 'TRIP_ASSIGNED', title: 'Рейсы назначены', owner: 'Логист', dependency: 'DISPATCH_PACKET', evidence: ['рейтинг перевозчика', 'назначение водителя', 'ETA'], output: 'Назначенные рейсы', risk: 'подмена ТС / слабый рейтинг перевозчика' },
  { code: 'LOADED', title: 'Погрузка завершена', owner: 'Водитель', dependency: 'TRIP_ASSIGNED', evidence: ['фото кузова', 'геометка', 'вес брутто', 'пломба'], output: 'Рейс в пути', risk: 'нет доказательств / фиктивная погрузка' },
  { code: 'RECEIVED', title: 'Приёмка завершена', owner: 'Элеватор', dependency: 'LOADED', evidence: ['брутто / тара / нетто', 'весовой талон', 'решение по приёмке'], output: 'досье приёмки', risk: 'спор по весу / очереди' },
  { code: 'LAB_FINAL', title: 'Лаборатория завершена', owner: 'Лаборатория', dependency: 'RECEIVED', evidence: ['цепочка отбора', 'протокол', 'классификация'], output: 'Результат по качеству', risk: 'неконсистентный протокол / ретест' },
  { code: 'SETTLEMENT_READY', title: 'Расчёт собран', owner: 'Бухгалтерия', dependency: 'LAB_FINAL', evidence: ['расчётный лист', 'документы готовы', 'банковский whitelist'], output: 'Готовность к выпуску денег', risk: 'ошибка перерасчёта / выпуск без оснований' },
  { code: 'RELEASED', title: 'Выплата проведена', owner: 'Финконтур', dependency: 'SETTLEMENT_READY', evidence: ['callback банка', 'журнал согласований', 'проводка в журнале'], output: 'Выплата отправлена', risk: 'ошибка счёта / двойной платёж' },
  { code: 'CLOSED', title: 'Сделка закрыта', owner: 'Платформа', dependency: 'RELEASED', evidence: ['журнал аудита', 'финальное досье'], output: 'Архив закрытой сделки', risk: 'незакрытый спор / неполный архив' }
];

export const roleOperatingMatrix: RoleMatrix[] = [
  {
    id: 'seller',
    role: 'Фермер / продавец',
    before: ['Создаёт лот', 'Заполняет адрес, road conditions, объём, базис', 'Подтверждает окна погрузки'],
    during: ['Сравнивает ставки по netback', 'Выбирает победителя', 'Подтверждает готовность двора и загрузки'],
    after: ['Следит за погрузкой', 'Подтверждает спорные отклонения', 'Видит payout outcome'],
    receivesFrom: ['Покупатель', 'Менеджер сопровождения'],
    handsOffTo: ['Логист', 'Водитель', 'Элеватор'],
    criticalEvidence: ['история лота', 'winner decision', 'фото погрузки'],
    mainAbuseRisk: 'продажа сверх объёма / обход платформы'
  },
  {
    id: 'buyer',
    role: 'Покупатель / трейдер',
    before: ['Проходит onboarding и лимиты', 'Смотрит условия лота', 'Оценивает логистический риск и риск по качеству'],
    during: ['Ставит bid', 'Подтверждает reserve / hold', 'Следит за ETA, приёмкой и лабораторией'],
    after: ['Подтверждает settlement', 'Закрывает release / dispute'],
    receivesFrom: ['Фермер', 'Лаборатория', 'Элеватор'],
    handsOffTo: ['Бухгалтерия', 'Менеджер сопровождения'],
    criticalEvidence: ['bid', 'payment callback банка', 'acceptance result'],
    mainAbuseRisk: 'затяжка оплаты / спор по качеству после приёмки'
  },
  {
    id: 'logistics',
    role: 'Логист / диспетчер',
    before: ['Получает логистический пакет', 'Проверяет рейтинг перевозчика', 'Назначает машины и слоты'],
    during: ['Контролирует ETA и deviation', 'Переназначает при срывах', 'Открывает support case при инциденте'],
    after: ['Закрывает рейсы и dwell', 'Передаёт receiving dossier'],
    receivesFrom: ['Продавец', 'Менеджер сопровождения'],
    handsOffTo: ['Водитель', 'Элеватор', 'Support'],
    criticalEvidence: ['логистический пакет', 'назначение перевозчика', 'маршрут контрольных точек'],
    mainAbuseRisk: 'слабый контроль перевозчика / скрытый простой'
  },
  {
    id: 'driver',
    role: 'Водитель',
    before: ['Принимает рейс', 'Проверяет адрес и дорогу', 'Строит маршрут до весовой'],
    during: ['Загружает evidence на каждом stop', 'Отмечает arrival/loading/departure', 'Обращается в support по шаблонам'],
    after: ['Подтверждает POD и выгрузку', 'Закрывает рейс'],
    receivesFrom: ['Логист'],
    handsOffTo: ['Элеватор', 'Лаборатория'],
    criticalEvidence: ['геометка', 'фото кузова', 'gross/tare', 'POD'],
    mainAbuseRisk: 'подмена маршрута / missing evidence'
  },
  {
    id: 'lab',
    role: 'Лаборатория',
    before: ['Получает sample chain и контекст партии'],
    during: ['Вносит показатели', 'Считает отклонение от базиса', 'Инициирует re-test при конфликте'],
    after: ['Публикует protocol', 'Передаёт delta в settlement'],
    receivesFrom: ['Элеватор', 'Водитель'],
    handsOffTo: ['Бухгалтерия', 'Dispute manager'],
    criticalEvidence: ['chain of custody', 'protocol', 'method'],
    mainAbuseRisk: 'противоречивый протокол'
  },
  {
    id: 'receiving',
    role: 'Элеватор / приёмка',
    before: ['Назначает слот выгрузки', 'Готовит очередь на площадке'],
    during: ['Фиксирует gate-in/out, брутто / тара / нетто', 'Решает accept/conditional/reject'],
    after: ['Передаёт scale dossier и batch reference'],
    receivesFrom: ['Логист', 'Водитель'],
    handsOffTo: ['Лаборатория', 'Inventory'],
    criticalEvidence: ['весовой талон', 'acceptance', 'событие очереди'],
    mainAbuseRisk: 'ошибка веса / затяжка очереди'
  },
  {
    id: 'finance',
    role: 'Бухгалтерия / финконтур',
    before: ['Проверяет whitelist и approval matrix'],
    during: ['Ведёт hold/reserve', 'Собирает расчётный лист', 'Решает partial release при dispute'],
    after: ['Публикует ledger и payout result'],
    receivesFrom: ['Покупатель', 'Лаборатория', 'Dispute manager'],
    handsOffTo: ['Продавец', 'Support'],
    criticalEvidence: ['bank callback банка', 'расчётный лист', 'payment docs'],
    mainAbuseRisk: 'release без полного dossier'
  },
  {
    id: 'ops',
    role: 'Менеджер сопровождения / operator',
    before: ['Контролирует activation gates'],
    during: ['Видит блокеры и очереди', 'Эскалирует риски', 'Соединяет роли между собой'],
    after: ['Закрывает incident log и финальный dossier'],
    receivesFrom: ['Все роли'],
    handsOffTo: ['Support', 'Risk', 'Executive'],
    criticalEvidence: ['журнал аудита', 'blockers log', 'escalations'],
    mainAbuseRisk: 'ручной override без dual-control'
  }
];
