export type ConnectionKind = 'ONE_C' | 'EDO' | 'BANK_STATEMENT';
export type ConnectionMaturity =
  | 'NOT_ATTESTED'
  | 'ADAPTER_READY'
  | 'TEST'
  | 'CONFIRMED_LIVE';

export type MissingPrerequisite =
  | 'ADAPTER_NOT_IMPLEMENTED'
  | 'ENDPOINT_NOT_CONFIGURED'
  | 'VENDOR_CREDENTIALS_NOT_ISSUED'
  | 'CONTRACT_NOT_ATTESTED'
  | 'TEST_EXCHANGE_NOT_PERFORMED'
  | 'LIVE_RECEIPT_NOT_OBTAINED';

export interface ConnectionStateDto {
  readonly kind: string;
  readonly maturity: string;
  readonly missing: readonly string[];
  readonly mayCarryRealTraffic: boolean;
}

export interface ConnectionAttestationDto {
  readonly id: string;
  readonly connectionKind: string;
  readonly state: {
    readonly attested: boolean;
    readonly awaiting: readonly string[];
    readonly rejected: readonly string[];
  };
}

export interface ConnectionCardPresentation {
  readonly title: string;
  readonly eyebrow: string;
  readonly status: string;
  readonly statusTone: 'neutral' | 'warning' | 'positive' | 'danger';
  readonly detail: string;
  readonly missing: readonly string[];
  readonly attestation: string;
  readonly realTrafficConfirmed: boolean;
  readonly actionLabel: string | null;
  readonly actionDisabledReason: string | null;
}

const TITLES: Readonly<Record<ConnectionKind, { title: string; eyebrow: string }>> = {
  ONE_C: { title: 'Учёт / 1С', eyebrow: 'Бухгалтерский учёт' },
  EDO: { title: 'ЭДО', eyebrow: 'Юридически значимые документы' },
  BANK_STATEMENT: { title: 'Банк / выписки', eyebrow: 'Иное подключение' },
};

const MISSING_TEXT: Readonly<Record<MissingPrerequisite, string>> = {
  ADAPTER_NOT_IMPLEMENTED: 'Для этого подключения ещё нет готового безопасного моста.',
  ENDPOINT_NOT_CONFIGURED: 'Организация ещё не выбрала, с какой внешней системой работать.',
  VENDOR_CREDENTIALS_NOT_ISSUED: 'Внешняя система ещё не подтвердила доступ этой организации.',
  CONTRACT_NOT_ATTESTED: 'Подключение ещё не прошло обязательные независимые проверки.',
  TEST_EXCHANGE_NOT_PERFORMED: 'Нет подтверждённого тестового обмена с внешней системой.',
  LIVE_RECEIPT_NOT_OBTAINED: 'Нет квитанции внешней системы, подтверждающей реальный обмен.',
};

export const CONNECTION_CENTER_REQUIRED_BUT_NOT_MODELED = Object.freeze([
  {
    title: 'ФГИС «Зерно»',
    detail: 'Платформа пока не показывает подтверждённый статус этого подключения на этом экране.',
  },
  {
    title: 'Перевозочные документы',
    detail: 'Платформа пока не показывает подтверждённый статус этого подключения на этом экране.',
  },
]);

export function presentConnection(
  connection: ConnectionStateDto,
  attestations: readonly ConnectionAttestationDto[],
): ConnectionCardPresentation {
  const kind = knownKind(connection.kind);
  const title = kind === null
    ? { title: 'Иное подключение', eyebrow: 'Внешняя система' }
    : TITLES[kind];

  const attestation = attestationsFor(connection.kind, attestations);
  const maturity = presentMaturity(connection.maturity, connection.mayCarryRealTraffic);
  const missing = connection.missing.map(presentMissing);

  return {
    ...title,
    ...maturity,
    missing,
    attestation,
    actionLabel: kind === 'ONE_C' ? 'Подключить 1С' : kind === 'EDO' ? 'Подключить ЭДО' : null,
    actionDisabledReason:
      kind === 'ONE_C'
        ? 'Недоступно: защищённая привязка этой организации к её 1С ещё не открыта для пользователя.'
        : kind === 'EDO'
          ? 'Недоступно: безопасная авторизация этой организации у оператора ЭДО ещё не открыта для пользователя.'
          : null,
  };
}

function knownKind(value: string): ConnectionKind | null {
  return value === 'ONE_C' || value === 'EDO' || value === 'BANK_STATEMENT'
    ? value
    : null;
}

function presentMaturity(
  maturity: string,
  mayCarryRealTraffic: boolean,
): Pick<
  ConnectionCardPresentation,
  'status' | 'statusTone' | 'detail' | 'realTrafficConfirmed'
> {
  if (maturity === 'CONFIRMED_LIVE' && mayCarryRealTraffic) {
    return {
      status: 'Реальный обмен подтверждён',
      statusTone: 'positive',
      detail: 'Внешняя система вернула доказанное подтверждение. Только этот уровень считается готовым к реальному обмену.',
      realTrafficConfirmed: true,
    };
  }

  // Fail closed on an internally inconsistent answer. A boolean alone never
  // upgrades a lower maturity level to live.
  if (mayCarryRealTraffic && maturity !== 'CONFIRMED_LIVE') {
    return {
      status: 'Требуется проверка статуса',
      statusTone: 'danger',
      detail: 'Получены несогласованные признаки. Реальный обмен не считается подтверждённым.',
      realTrafficConfirmed: false,
    };
  }

  if (maturity === 'TEST') {
    return {
      status: 'Тестовый обмен подтверждён',
      statusTone: 'warning',
      detail: 'Тест прошёл, но реальный обмен с внешней системой ещё не доказан.',
      realTrafficConfirmed: false,
    };
  }
  if (maturity === 'ADAPTER_READY') {
    return {
      status: 'Подготовка завершена',
      statusTone: 'warning',
      detail: 'Техническая часть проверена, но внешнее подключение и реальный обмен ещё не подтверждены.',
      realTrafficConfirmed: false,
    };
  }
  if (maturity === 'NOT_ATTESTED') {
    return {
      status: 'Ещё не готово',
      statusTone: 'neutral',
      detail: 'Показываем только подтверждённые шаги. Отсутствующие условия перечислены ниже.',
      realTrafficConfirmed: false,
    };
  }

  return {
    status: 'Статус не распознан',
    statusTone: 'danger',
    detail: 'Получен неизвестный статус. Реальный обмен считается неподтверждённым до разбирательства.',
    realTrafficConfirmed: false,
  };
}

function presentMissing(value: string): string {
  if (value in MISSING_TEXT) {
    return MISSING_TEXT[value as MissingPrerequisite];
  }
  return 'Есть условие подключения, которое этот экран пока не умеет объяснить. Обратитесь к администратору организации.';
}

function attestationsFor(
  kind: string,
  attestations: readonly ConnectionAttestationDto[],
): string {
  const subjects = attestations.filter((subject) => subject.connectionKind === kind);
  if (subjects.length === 0) return 'Независимая проверка подключения ещё не начата.';
  if (subjects.some((subject) => subject.state.rejected.length > 0)) {
    return 'Есть отклонённая независимая проверка. Подключение не может считаться готовым.';
  }
  if (subjects.some((subject) => subject.state.attested)) {
    return 'Есть подключение, прошедшее все обязательные независимые проверки.';
  }
  return 'Независимая проверка начата, но ещё не завершена.';
}
