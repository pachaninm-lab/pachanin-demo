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
        nextStep: 'Назначить владельца каждого документа и проверить SLA',
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
