export type ProblemClosureStatus = 'CLOSED_BY_CODE' | 'HARDENING_IN_CODE' | 'CODE_PLUS_LIVE' | 'LIVE_DEPENDENT';
export type ProblemClosureDependency =
  | 'canonical_passport'
  | 'unified_profile'
  | 'status_timeline'
  | 'offline_queue'
  | 'retry_and_sla'
  | 'document_wizard'
  | 'document_correction'
  | 'provider_registry'
  | 'connector_health'
  | 'browser_access'
  | 'registry_live_check'
  | 'edo_epd_live'
  | 'goslog_live'
  | 'sdiz_validation';

export type ProblemClosureRecord = {
  no: number;
  title: string;
  category: 'code' | 'code_plus_live';
  status: ProblemClosureStatus;
  currentClosure: string[];
  hardeningNow: string[];
  dependencies: ProblemClosureDependency[];
  blockingLive?: string[];
};

const HARDENING_PROBLEMS: ProblemClosureRecord[] = [
  {
    no: 3,
    title: 'Много разрозненных госинформсистем',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['единая карточка сделки', 'единый таймлайн', 'единый операторский слой'],
    hardeningNow: ['unified deal passport', 'канонический паспорт партии', 'маппинг наружных статусов'],
    dependencies: ['canonical_passport', 'status_timeline', 'connector_health']
  },
  {
    no: 5,
    title: 'Единое окно ещё не введено полноценно',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['единое окно платформы', 'операторский контур'],
    hardeningNow: ['единый маршрут блокеров', 'health по коннекторам', 'manual fallback с owner'],
    dependencies: ['canonical_passport', 'connector_health', 'retry_and_sla']
  },
  {
    no: 7,
    title: 'Нет единого окна, единой авторизации и бесшовного обмена',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['ролевой вход', 'каноническая модель сделки'],
    hardeningNow: ['единый профиль участника', 'единый паспорт сделки', 'унификация полей для обмена наружу'],
    dependencies: ['unified_profile', 'canonical_passport', 'status_timeline']
  },
  {
    no: 8,
    title: 'Для работы с ФГИС нужен стабильный интернет, есть API/СДИЗ-сбои',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['offline queue', 'операторская эскалация'],
    hardeningNow: ['retry policy', 'dead-letter routing', 'connector health normalization'],
    dependencies: ['offline_queue', 'retry_and_sla', 'connector_health']
  },
  {
    no: 10,
    title: 'Ошибки в системах и сертификатах трудно исправлять',
    category: 'code',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['audit trail', 'контроль документов'],
    hardeningNow: ['correction workflow', 'reasoned actions', 'типовые планы исправления'],
    dependencies: ['document_correction', 'document_wizard']
  },
  {
    no: 14,
    title: 'Барьер доступа из-за требований к браузеру',
    category: 'code',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['PWA', 'мобильные поверхности'],
    hardeningNow: ['browser support matrix', 'graceful degradation', 'capability checks'],
    dependencies: ['browser_access', 'offline_queue']
  },
  {
    no: 15,
    title: 'Нарушения при оформлении СДИЗ и товаросопроводительных документов',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['document completeness', 'gates before release'],
    hardeningNow: ['SDIZ validation', 'wizard correction plan', 'ошибки до отправки'],
    dependencies: ['document_wizard', 'document_correction', 'sdiz_validation']
  },
  {
    no: 17,
    title: 'Типовые ошибки при оформлении СДИЗ',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['валидация обязательных полей'],
    hardeningNow: ['коррекционный мастер', 'reason codes', 'готовый маршрут исправления'],
    dependencies: ['sdiz_validation', 'document_correction']
  },
  {
    no: 18,
    title: 'Фантомные лаборатории и недействительные декларации',
    category: 'code_plus_live',
    status: 'CODE_PLUS_LIVE',
    currentClosure: ['manual provider review', 'quality gates'],
    hardeningNow: ['compliance gates по лаборатории', 'разделение sandbox/live registry'],
    dependencies: ['provider_registry', 'registry_live_check'],
    blockingLive: ['live реестр аккредитованных лабораторий']
  },
  {
    no: 19,
    title: 'Обязательный переход на электронные перевозочные документы',
    category: 'code_plus_live',
    status: 'CODE_PLUS_LIVE',
    currentClosure: ['документный контур', 'подписные статусы'],
    hardeningNow: ['EPD readiness gate', 'fail-closed по неполному пакету'],
    dependencies: ['document_wizard', 'provider_registry', 'edo_epd_live'],
    blockingLive: ['боевое ЭДО', 'боевой ГИС ЭПД', 'боевой КЭП']
  },
  {
    no: 20,
    title: 'Обязательный реестр «ГосЛог» для экспедиторов',
    category: 'code_plus_live',
    status: 'CODE_PLUS_LIVE',
    currentClosure: ['manual KYC и provider selection'],
    hardeningNow: ['expeditor compliance gate', 'разделение sandbox/live registry'],
    dependencies: ['provider_registry', 'goslog_live'],
    blockingLive: ['live-доступ к реестру ГосЛог для экспедиторов']
  },
  {
    no: 21,
    title: 'Обязательный реестр «ГосЛог» для перевозчиков',
    category: 'code_plus_live',
    status: 'CODE_PLUS_LIVE',
    currentClosure: ['carrier KYC и provider selection'],
    hardeningNow: ['carrier compliance gate', 'контроль допуска по live-проверке'],
    dependencies: ['provider_registry', 'goslog_live'],
    blockingLive: ['live-доступ к реестру ГосЛог для перевозчиков']
  },
  {
    no: 23,
    title: 'ФГИС технологически не сшиты между собой',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['интеграционный слой', 'каноническая модель'],
    hardeningNow: ['единый health dictionary', 'маршрут callback/retry/dead-letter', 'единый контракт обмена'],
    dependencies: ['connector_health', 'retry_and_sla', 'canonical_passport']
  },
  {
    no: 25,
    title: 'Массовое недостоверное декларирование',
    category: 'code_plus_live',
    status: 'HARDENING_IN_CODE',
    currentClosure: ['mandatory evidence', 'document completeness', 'operator review'],
    hardeningNow: ['provenance-oriented correction flow', 'high-risk review plan', 'mandatory sources by scenario'],
    dependencies: ['document_correction', 'provider_registry', 'sdiz_validation']
  }
];

export function listHardeningProblems() {
  return HARDENING_PROBLEMS.slice();
}

export function resolveHardeningProblem(no: number) {
  return HARDENING_PROBLEMS.find((item) => item.no === no) || null;
}

export function summarizeHardeningProblems() {
  const summary = {
    total: HARDENING_PROBLEMS.length,
    codeOnly: 0,
    codePlusLive: 0,
    hardeningInCode: 0,
    needsLiveClosure: 0,
    dependencies: {} as Record<ProblemClosureDependency, number>
  };

  for (const item of HARDENING_PROBLEMS) {
    if (item.category === 'code') summary.codeOnly += 1;
    else summary.codePlusLive += 1;
    if (item.status === 'HARDENING_IN_CODE') summary.hardeningInCode += 1;
    if (item.status === 'CODE_PLUS_LIVE' || item.status === 'LIVE_DEPENDENT') summary.needsLiveClosure += 1;
    for (const dependency of item.dependencies) {
      summary.dependencies[dependency] = (summary.dependencies[dependency] || 0) + 1;
    }
  }

  return summary;
}

export function listHardeningFunctions() {
  return Array.from(new Set(HARDENING_PROBLEMS.flatMap((item) => item.hardeningNow)));
}
