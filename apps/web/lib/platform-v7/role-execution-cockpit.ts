import type { GrainExecutionRole, GrainExecutionTone } from '@/lib/platform-v7/design/execution-cockpit';

export type RoleExecutionActionTone = 'primary' | 'secondary' | 'warning' | 'danger';

export interface RoleExecutionAction {
  readonly label: string;
  readonly href?: string;
  readonly disabled?: boolean;
  readonly tone?: RoleExecutionActionTone;
}

export interface RoleExecutionOperation {
  readonly title: string;
  readonly status: string;
  readonly statusTone?: GrainExecutionTone;
  readonly shortFact: string;
  readonly blocker?: string;
  readonly blockerTone?: 'warning' | 'danger' | 'success';
  readonly nextStep: string;
  readonly action: RoleExecutionAction;
  readonly cause?: string;
}

export interface RoleExecutionKpi {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly tone?: GrainExecutionTone;
}

export interface RoleExecutionStatus {
  readonly label: string;
  readonly tone: GrainExecutionTone;
}

export interface RoleExecutionCockpitModel {
  readonly role: GrainExecutionRole;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly statuses: readonly RoleExecutionStatus[];
  readonly kpis: readonly RoleExecutionKpi[];
  readonly operations: readonly RoleExecutionOperation[];
}

export const PRIMARY_ROLE_EXECUTION_COCKPITS = {
  seller: {
    role: 'seller',
    eyebrow: 'Продавец · партия → лот → документы → деньги',
    title: 'Закрыть СДИЗ и приёмку, чтобы основание ушло банку',
    subtitle: 'Продавец видит партию, лот, резерв, СДИЗ, ЭТрН, приёмку, качество и причину, почему деньги ещё не переданы на банковскую проверку.',
    statuses: [
      { label: 'Роль: продавец', tone: 'success' },
      { label: 'Деньги ждут документы', tone: 'warning' },
      { label: 'Груз на приёмке', tone: 'info' },
    ],
    kpis: [
      { label: 'Резерв покупателя', value: '9,65 млн ₽', note: 'готовность денег; это не выплата', tone: 'money' },
      { label: 'На проверку банку', value: '0 ₽', note: 'основание не передано из-за СДИЗ и ЭТрН', tone: 'danger' },
      { label: 'Документы', value: '4/7', note: 'СДИЗ, ЭТрН и акт приёмки блокируют следующий шаг', tone: 'warning' },
      { label: 'Логистика', value: 'рейс 62%', note: 'машина в пути; приёмка ещё не закрыта', tone: 'info' },
    ],
    operations: [
      {
        title: 'Документный допуск',
        status: 'ожидает закрытия',
        statusTone: 'warning',
        shortFact: 'СДИЗ и ЭТрН не закрыты по DL-9106',
        blocker: 'Банк не получает основание до закрытых документов',
        cause: 'ФГИС, транспортная накладная и акт приёмки ещё не дают полный пакет',
        nextStep: 'Закрыть СДИЗ, ЭТрН и акт приёмки',
        action: { label: 'Закрыть СДИЗ', href: '/platform-v7/deals/grain-sdiz' },
      },
      {
        title: 'Деньги продавца',
        status: 'ждёт банк',
        statusTone: 'money',
        shortFact: 'Резерв 9,65 млн ₽ виден, к передаче банку 0 ₽',
        blocker: 'Нет полного основания для банковской проверки',
        nextStep: 'После документов передать основание банку',
        action: { label: 'Передать основание банку', href: '/platform-v7/bank/release-safety', tone: 'secondary' },
      },
    ],
  },
  buyer: {
    role: 'buyer',
    eyebrow: 'Покупатель · RFQ → оффер → резерв → логистика',
    title: 'Подтвердить резерв и условия, чтобы сделка пошла в исполнение',
    subtitle: 'Покупатель видит запрос, выбранную партию, резерв, удержание, документы, качество и то, что сейчас блокирует переход к логистике.',
    statuses: [
      { label: 'Роль: покупатель', tone: 'success' },
      { label: 'Резерв ждёт банк', tone: 'warning' },
      { label: 'Качество на контроле', tone: 'info' },
    ],
    kpis: [
      { label: 'Мой резерв', value: '9,65 млн ₽', note: 'ожидает банковского подтверждения', tone: 'money' },
      { label: 'Удержание', value: '624 тыс. ₽', note: 'спорная часть по весу и качеству', tone: 'warning' },
      { label: 'Документы', value: '5/8', note: 'нужно закрыть банковское основание', tone: 'info' },
      { label: 'Следующий шаг', value: 'резерв', note: 'запросить подтверждение резерва', tone: 'success' },
    ],
    operations: [
      {
        title: 'Денежный резерв',
        status: 'ожидает банк',
        statusTone: 'warning',
        shortFact: 'Сделка не переходит к логистике до банковского статуса',
        blocker: 'Резерв ещё не подтверждён банком',
        cause: 'Платформа показывает запрос и причину ожидания; банк подтверждает статус',
        nextStep: 'Запросить подтверждение резерва',
        action: { label: 'Запросить подтверждение резерва', href: '/platform-v7/deals/DL-9106/money' },
      },
      {
        title: 'Качество и приёмка',
        status: 'проверка',
        statusTone: 'info',
        shortFact: 'Протокол качества и акт приёмки влияют на удержание',
        blocker: 'Спорная часть не выпускается до закрытия расхождения',
        nextStep: 'Дождаться протокола и акта расхождения',
        action: { label: 'Создать акт расхождения', href: '/platform-v7/deals/grain-quality', tone: 'secondary' },
      },
    ],
  },
  operator: {
    role: 'operator',
    eyebrow: 'Оператор · контроль сделки → блокеры → следующий владелец',
    title: 'Снять блокеры исполнения и не потерять деньги в ожидании',
    subtitle: 'Оператор видит очередь сделок как деньги, документы, груз, качество, владелец блокера и одно безопасное действие.',
    statuses: [
      { label: 'Роль: оператор', tone: 'success' },
      { label: '3 стопа', tone: 'danger' },
      { label: 'ручная сверка', tone: 'warning' },
    ],
    kpis: [
      { label: 'В резерве', value: '15,89 млн ₽', note: 'по активным сделкам', tone: 'money' },
      { label: 'Под удержанием', value: '624 тыс. ₽', note: 'спорная часть, не вся сделка', tone: 'warning' },
      { label: 'К проверке банком', value: '0 ₽', note: 'условия ещё не закрыты', tone: 'danger' },
      { label: 'Рейсы / качество', value: '2 / 1', note: 'рейсы в работе, один протокол ждёт загрузки', tone: 'info' },
    ],
    operations: [
      {
        title: 'Главный стоп денег',
        status: 'остановлено',
        statusTone: 'danger',
        shortFact: 'DL-9106 не передаёт основание банку',
        blocker: 'СДИЗ, ЭТрН, акт и качество не закрыты',
        nextStep: 'Назначить владельца каждого документа и проверить срок закрытия',
        action: { label: 'Открыть документы', href: '/platform-v7/deals/DL-9106/documents', tone: 'danger' },
      },
      {
        title: 'Операционная очередь',
        status: 'в работе',
        statusTone: 'info',
        shortFact: 'У каждой строки есть владелец, причина и денежный эффект',
        blocker: 'Нельзя обходить ручную проверку без основания',
        nextStep: 'Разобрать очередь по деньгам под риском',
        action: { label: 'Собрать доказательства', href: '/platform-v7/evidence-pack', tone: 'secondary' },
      },
    ],
  },
  bank: {
    role: 'bank',
    eyebrow: 'Банк · резерв → основание → подтверждение статуса',
    title: 'Проверить основание, удержание и причину остановки',
    subtitle: 'Банк видит сумму, документы, статус резерва, удержание и причину. Платформа не двигает деньги сама; она показывает основание и статус.',
    statuses: [
      { label: 'Роль: банк', tone: 'success' },
      { label: 'основание не готово', tone: 'warning' },
      { label: 'удержание видно', tone: 'money' },
    ],
    kpis: [
      { label: 'В резерве', value: '15,89 млн ₽', note: 'по двум сделкам', tone: 'money' },
      { label: 'К передаче банку', value: '0 ₽', note: 'нет полного основания', tone: 'danger' },
      { label: 'Под удержанием', value: '624 тыс. ₽', note: 'по спорной части', tone: 'warning' },
      { label: 'Документы', value: 'не готовы', note: 'СДИЗ, ЭТрН, УПД, акт, качество', tone: 'warning' },
    ],
    operations: [
      {
        title: 'Основание для банка',
        status: 'стоп',
        statusTone: 'danger',
        shortFact: 'DL-9106 не готова к банковской проверке',
        blocker: 'Нет закрытых документов и приёмки',
        cause: 'Банк подтверждает статус после проверки основания',
        nextStep: 'Дождаться закрытия условий и сверить пакет',
        action: { label: 'Проверить деньги', href: '/platform-v7/bank/release-safety', tone: 'danger' },
      },
      {
        title: 'Удержание по спору',
        status: 'ручная проверка',
        statusTone: 'warning',
        shortFact: '624 тыс. ₽ удержано до решения по расхождению',
        blocker: 'Нужен акт и решение по спорной части',
        nextStep: 'Открыть доказательства и причину удержания',
        action: { label: 'Собрать доказательства', href: '/platform-v7/disputes', tone: 'secondary' },
      },
    ],
  },
  compliance: {
    role: 'compliance',
    eyebrow: 'Комплаенс · допуск → риск → документы → решение',
    title: 'Проверить контрагента, документы и риск перед движением сделки',
    subtitle: 'Комплаенс видит не коммерческую витрину, а допуск сделки: правила, источник риска, документы, блокер и что нажать сейчас.',
    statuses: [
      { label: 'Роль: комплаенс', tone: 'success' },
      { label: 'допуск на проверке', tone: 'warning' },
      { label: 'источник риска указан', tone: 'info' },
    ],
    kpis: [
      { label: 'Контрагенты', value: '2 на проверке', note: 'нужен ручной допуск', tone: 'warning' },
      { label: 'Документы', value: '6/8', note: 'не хватает подтверждений по сделке', tone: 'info' },
      { label: 'Риски', value: '1 стоп', note: 'требует причины и решения', tone: 'danger' },
      { label: 'Следующий шаг', value: 'допуск', note: 'зафиксировать причину решения', tone: 'success' },
    ],
    operations: [
      {
        title: 'Допуск сделки',
        status: 'ручная проверка',
        statusTone: 'warning',
        shortFact: 'Контрагент и документы требуют подтверждения',
        blocker: 'Нет финального решения по правилу допуска',
        cause: 'Источник риска должен быть виден оператору и банку',
        nextStep: 'Зафиксировать основание решения и открыть документы',
        action: { label: 'Открыть документы', href: '/platform-v7/documents', tone: 'secondary' },
      },
      {
        title: 'Риск обхода',
        status: 'проверка',
        statusTone: 'info',
        shortFact: 'События сделки и переписка сверяются с правилами',
        blocker: 'Нельзя продолжать без причины ручного допуска',
        nextStep: 'Собрать доказательства и обновить статус риска',
        action: { label: 'Собрать доказательства', href: '/platform-v7/evidence-pack' },
      },
    ],
  },
} as const satisfies Record<'seller' | 'buyer' | 'operator' | 'bank' | 'compliance', RoleExecutionCockpitModel>;

export const OPERATIONAL_ROLE_EXECUTION_COCKPITS = {
  logistics: {
    role: 'logistics',
    eyebrow: 'Логистика · рейс → водитель → ЭТрН → приёмка',
    title: 'Довести рейс до приёмки и закрыть транспортные документы',
    subtitle: 'Логистика видит заказ, водителя, маршрут, ЭТрН, ГИС ЭПД, СДИЗ, инциденты и следующего владельца. Коммерческие условия и банковские действия скрыты.',
    statuses: [
      { label: 'Роль: логистика', tone: 'success' },
      { label: 'рейс 62%', tone: 'info' },
      { label: 'ЭТрН ждёт подпись', tone: 'warning' },
    ],
    kpis: [
      { label: 'В пути', value: '1 рейс', note: 'TRIP-SIM-001 · 62% маршрута', tone: 'info' },
      { label: 'Прибыли', value: '1 рейс', note: 'ожидает акт приёмки и сверку веса', tone: 'success' },
      { label: 'Инциденты', value: '1', note: 'отклонение веса требует акта', tone: 'warning' },
      { label: 'Документы', value: 'ЭТрН', note: 'подпись грузополучателя блокирует следующий шаг', tone: 'warning' },
    ],
    operations: [
      {
        title: 'Текущий рейс',
        status: 'в пути',
        statusTone: 'info',
        shortFact: 'TRIP-SIM-001 · 62% маршрута · прибытие 14:28',
        blocker: 'ЭТрН не закрыта грузополучателем',
        cause: 'ГИС ЭПД и СДИЗ ждут транспортное подтверждение',
        nextStep: 'Контролировать прибытие и подпись ЭТрН',
        action: { label: 'Открыть рейс водителя', href: '/platform-v7/driver/field' },
      },
      {
        title: 'Неназначенный заказ',
        status: 'ожидает',
        statusTone: 'warning',
        shortFact: 'LOG-9103 не имеет водителя и ЭТрН',
        blocker: 'Нельзя создать транспортный пакет без водителя',
        nextStep: 'Назначить водителя и создать ЭТрН',
        action: { label: 'Назначить водителя', href: '/platform-v7/logistics/inbox', tone: 'secondary' },
      },
    ],
  },
  driver: {
    role: 'driver',
    eyebrow: 'Водитель · один рейс · одно действие',
    title: 'Рейс водителя',
    subtitle: 'На экране только маршрут, связь, прибытие, фото, вес и пломба. Коммерческий и чужой контекст скрыт.',
    statuses: [
      { label: 'Роль: водитель', tone: 'success' },
      { label: 'только текущий рейс', tone: 'info' },
      { label: 'офлайн-очередь', tone: 'warning' },
    ],
    kpis: [
      { label: 'Рейс', value: 'TRIP-SIM-001', note: 'одна активная задача', tone: 'info' },
      { label: 'GPS', value: '62%', note: 'маршрут до элеватора', tone: 'success' },
      { label: 'ETA', value: '14:28', note: 'следующая точка прибытия', tone: 'warning' },
      { label: 'Очередь', value: 'локально', note: 'события сохраняются без связи', tone: 'neutral' },
    ],
    operations: [
      {
        title: 'Текущий рейс',
        status: 'одно действие',
        statusTone: 'success',
        shortFact: 'TRIP-SIM-001 · маршрут до элеватора ВРЖ-08',
        blocker: 'Активного стопа нет; нужно подтвердить прибытие',
        nextStep: 'Подтвердить прибытие, затем приложить фото, пломбу и вес',
        action: { label: 'Подтвердить прибытие', href: '#driver-next-action' },
      },
    ],
  },
  elevator: {
    role: 'elevator',
    eyebrow: 'Элеватор · прибытие → вес → проба → акт',
    title: 'Зафиксировать вес, качество и акт расхождения',
    subtitle: 'Приёмка видит груз, рейс, вес, лабораторию, документы и отклонения. Коммерческие условия, резерв и кредит остаются вне этой роли.',
    statuses: [
      { label: 'Роль: элеватор', tone: 'success' },
      { label: 'вес расходится', tone: 'danger' },
      { label: 'проба отобрана', tone: 'info' },
    ],
    kpis: [
      { label: 'Рейс', value: 'TRIP-SIM-001', note: 'прибыл на элеватор ВРЖ-08', tone: 'success' },
      { label: 'Вес', value: '-1,2 т', note: 'отклонение создаёт акт расхождения', tone: 'danger' },
      { label: 'Качество', value: 'проба', note: 'сорная примесь выше допуска', tone: 'warning' },
      { label: 'Документы', value: 'акт', note: 'акт приёмки готовится', tone: 'info' },
    ],
    operations: [
      {
        title: 'Вес и акт',
        status: 'расхождение',
        statusTone: 'danger',
        shortFact: '600 т заявлено · 598,8 т принято',
        blocker: 'Нужен акт расхождения до передачи основания',
        cause: 'Отклонение веса влияет на удержание и спорную часть',
        nextStep: 'Зафиксировать вес и подписать акт приёмки',
        action: { label: 'Зафиксировать вес', href: '/platform-v7/elevator', tone: 'danger' },
      },
      {
        title: 'Качество партии',
        status: 'ожидает протокол',
        statusTone: 'warning',
        shortFact: 'Сорная примесь 2,4% при допуске до 2%',
        blocker: 'Без протокола нельзя закрыть доказательный пакет',
        nextStep: 'Передать пробу и создать акт расхождения',
        action: { label: 'Создать акт расхождения', href: '/platform-v7/lab', tone: 'secondary' },
      },
    ],
  },
  lab: {
    role: 'lab',
    eyebrow: 'Лаборатория · проба → показатели → протокол',
    title: 'Прикрепить протокол качества к доказательному контуру',
    subtitle: 'Лаборатория видит пробу, показатели, отклонение и итоговый допуск. Коммерческий контекст, спорное решение и чужие действия остаются вне роли.',
    statuses: [
      { label: 'Роль: лаборатория', tone: 'success' },
      { label: 'проба отобрана', tone: 'info' },
      { label: 'протокол нужен', tone: 'warning' },
    ],
    kpis: [
      { label: 'Проба', value: 'отобрана', note: 'привязана к рейсу TRIP-SIM-001', tone: 'success' },
      { label: 'Показатели', value: '3/4', note: 'влага и клейковина в допуске', tone: 'info' },
      { label: 'Отклонение', value: 'сорность', note: '2,4% при допуске до 2%', tone: 'warning' },
      { label: 'Протокол', value: 'ожидается', note: 'нужно прикрепить файл и итог', tone: 'warning' },
    ],
    operations: [
      {
        title: 'Протокол качества',
        status: 'ожидает',
        statusTone: 'warning',
        shortFact: 'Протокол по TRIP-SIM-001 ещё не прикреплён',
        blocker: 'Качество не подтверждено документом',
        nextStep: 'Прикрепить протокол и итоговый допуск',
        action: { label: 'Прикрепить протокол', href: '/platform-v7/lab' },
      },
      {
        title: 'Отклонение показателя',
        status: 'проверка',
        statusTone: 'info',
        shortFact: 'Сорная примесь выше допуска',
        blocker: 'Нужен комментарий лаборатории к протоколу',
        nextStep: 'Зафиксировать показатель и причину отклонения',
        action: { label: 'Прикрепить протокол', href: '/platform-v7/lab', tone: 'secondary' },
      },
    ],
  },
  surveyor: {
    role: 'surveyor',
    eyebrow: 'Сюрвейер · осмотр → фото → расхождение → заключение',
    title: 'Собрать независимые доказательства на площадке',
    subtitle: 'Сюрвейер видит осмотр, фото, состояние груза, расхождения, замечания и заключение. Коммерческий контекст и чужие рабочие очереди скрыты.',
    statuses: [
      { label: 'Роль: сюрвейер', tone: 'success' },
      { label: 'фото нужны', tone: 'warning' },
      { label: 'заключение в работе', tone: 'info' },
    ],
    kpis: [
      { label: 'Осмотр', value: 'в работе', note: 'привязать к рейсу и партии', tone: 'info' },
      { label: 'Фото', value: 'нужно', note: 'пломба, кузов, место отбора', tone: 'warning' },
      { label: 'Расхождение', value: '-1,2 т', note: 'подтверждается актом и фото', tone: 'danger' },
      { label: 'Заключение', value: 'черновик', note: 'доказательный контур ждёт итог', tone: 'warning' },
    ],
    operations: [
      {
        title: 'Осмотр площадки',
        status: 'в работе',
        statusTone: 'info',
        shortFact: 'Нужны фото груза, пломбы и места отбора пробы',
        blocker: 'Доказательства неполные без фото и заключения',
        nextStep: 'Собрать доказательства и прикрепить заключение',
        action: { label: 'Собрать доказательства', href: '/platform-v7/evidence-pack' },
      },
      {
        title: 'Расхождение веса',
        status: 'проверка',
        statusTone: 'warning',
        shortFact: 'Отклонение -1,2 т требует независимой фиксации',
        blocker: 'Нельзя закрыть спорную часть без заключения',
        nextStep: 'Зафиксировать замечание и связать его с актом',
        action: { label: 'Создать акт расхождения', href: '/platform-v7/disputes', tone: 'secondary' },
      },
    ],
  },
  arbitrator: {
    role: 'arbitrator',
    eyebrow: 'Арбитр · спор → доказательства → решение',
    title: 'Принять решение по спорной части на основании фактов',
    subtitle: 'Арбитр видит сумму спора, акт, протокол, вес, фото, журнал и причину остановки. Решение фиксируется как основание для ручной сверки.',
    statuses: [
      { label: 'Роль: арбитр', tone: 'success' },
      { label: 'ручная сверка', tone: 'warning' },
      { label: 'доказательства нужны', tone: 'info' },
    ],
    kpis: [
      { label: 'Сумма спора', value: '624 тыс. ₽', note: 'только спорная часть', tone: 'money' },
      { label: 'Доказательства', value: '5/7', note: 'акт, протокол, вес, фото, журнал', tone: 'warning' },
      { label: 'Решение', value: 'черновик', note: 'нужна причина и сумма', tone: 'info' },
      { label: 'Следующий шаг', value: 'сверка', note: 'оператор проверяет основание', tone: 'success' },
    ],
    operations: [
      {
        title: 'Решение по спору',
        status: 'черновик',
        statusTone: 'warning',
        shortFact: 'Спор по весу и качеству требует решения по 624 тыс. ₽',
        blocker: 'Не хватает полного пакета доказательств',
        nextStep: 'Собрать доказательства и зафиксировать причину решения',
        action: { label: 'Собрать доказательства', href: '/platform-v7/evidence-pack' },
      },
      {
        title: 'Журнал решения',
        status: 'ожидает запись',
        statusTone: 'info',
        shortFact: 'Причина решения должна быть видна оператору и банку',
        blocker: 'Нельзя закрыть спор без записи в журнале',
        nextStep: 'Зафиксировать решение, сумму и основание удержания',
        action: { label: 'Открыть спор', href: '/platform-v7/disputes', tone: 'secondary' },
      },
    ],
  },
  executive: {
    role: 'executive',
    eyebrow: 'Руководитель · деньги → стопы → сроки → решение',
    title: 'Видеть исполнение сделки без провала в операционные детали',
    subtitle: 'Executive-экран показывает деньги в контуре, стопы, сроки, спорную часть, владельца блокера и следующий управленческий шаг.',
    statuses: [
      { label: 'Роль: руководитель', tone: 'success' },
      { label: 'есть стопы', tone: 'danger' },
      { label: 'сроки под контролем', tone: 'info' },
    ],
    kpis: [
      { label: 'В резерве', value: '15,89 млн ₽', note: 'активные сделки', tone: 'money' },
      { label: 'Под риском', value: '624 тыс. ₽', note: 'спорная часть, не вся сделка', tone: 'warning' },
      { label: 'Стопы', value: '3', note: 'документы, качество, решение', tone: 'danger' },
      { label: 'Сроки', value: '2 окна', note: 'ожидают владельца', tone: 'info' },
    ],
    operations: [
      {
        title: 'Исполнительный стоп',
        status: 'требует внимания',
        statusTone: 'danger',
        shortFact: 'DL-9106 остановлена на документах, качестве и спорной части',
        blocker: 'Нужен владелец решения и срок закрытия',
        nextStep: 'Назначить владельца блокера и проверить срок закрытия',
        action: { label: 'Открыть контроль сделки', href: '/platform-v7/control-tower' },
      },
      {
        title: 'Риск денег',
        status: 'ручная проверка',
        statusTone: 'warning',
        shortFact: '624 тыс. ₽ остаются в удержании до решения',
        blocker: 'Нет закрытого доказательного пакета',
        nextStep: 'Проверить доказательства и причину удержания',
        action: { label: 'Собрать доказательства', href: '/platform-v7/evidence-pack', tone: 'secondary' },
      },
    ],
  },
} as const satisfies Record<'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'arbitrator' | 'executive', RoleExecutionCockpitModel>;

export const ALL_ROLE_EXECUTION_COCKPITS = {
  ...PRIMARY_ROLE_EXECUTION_COCKPITS,
  ...OPERATIONAL_ROLE_EXECUTION_COCKPITS,
} as const satisfies Record<GrainExecutionRole, RoleExecutionCockpitModel>;
