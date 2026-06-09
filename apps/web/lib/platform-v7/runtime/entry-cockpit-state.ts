export type PlatformV7EntryTone = 'red' | 'amber' | 'blue';

export type PlatformV7EntryBlocker = {
  id: string;
  title: string;
  cause: string;
  money: string;
  owner: string;
  href: string;
  tone: PlatformV7EntryTone;
};

export type PlatformV7EntryLane = {
  label: string;
  value: string;
  state: string;
  tone: PlatformV7EntryTone;
};

export type PlatformV7RoleEntrypoint = {
  role: string;
  href: string;
  focus: string;
  action: string;
};

export type PlatformV7ProofItem = {
  label: string;
  text: string;
};

export type PlatformV7EntryCockpitState = {
  executionPath: string[];
  blockers: PlatformV7EntryBlocker[];
  lanes: PlatformV7EntryLane[];
  roleEntrypoints: PlatformV7RoleEntrypoint[];
  proofItems: PlatformV7ProofItem[];
  primaryBlocker: PlatformV7EntryBlocker | null;
  maturityNotice: string;
  sourceMeta: {
    source: 'controlled-pilot-runtime-fixture';
    runtimeBound: true;
    liveExternalIntegrations: false;
  };
};

const fixture = {
  executionPath: [
    'цена и допуск',
    'сделка',
    'логистика',
    'приёмка',
    'документы',
    'деньги',
    'спор',
    'доказательства',
  ],
  blockers: [
    {
      id: 'DL-9106',
      title: 'СДИЗ не подтверждён',
      cause: 'партия не подтверждена в документальном контуре',
      money: '9,65 млн ₽',
      owner: 'Продавец',
      href: '/platform-v7/deals/DL-9106/clean',
      tone: 'red',
    },
    {
      id: 'DL-9102',
      title: 'Спорная часть по весу',
      cause: 'акт расхождения удерживает часть расчёта',
      money: '624 тыс. ₽',
      owner: 'Арбитр',
      href: '/platform-v7/disputes/DSP-9102',
      tone: 'amber',
    },
    {
      id: 'LOG-REQ-2403',
      title: 'ЭТрН ждёт подписи',
      cause: 'рейс есть, но транспортный пакет не завершён',
      money: 'основание банку',
      owner: 'Логистика',
      href: '/platform-v7/logistics',
      tone: 'amber',
    },
  ],
  lanes: [
    { label: 'Деньги', value: '15,89 млн ₽', state: 'стоят до закрытия документов', tone: 'red' },
    { label: 'Документы', value: '2 стопа', state: 'СДИЗ · ЭТрН', tone: 'amber' },
    { label: 'Рейс', value: '1 под риском', state: 'подпись ЭТрН', tone: 'amber' },
    { label: 'Спор', value: '624 тыс. ₽', state: 'удержание по весу', tone: 'red' },
  ],
  roleEntrypoints: [
    {
      role: 'Оператор',
      href: '/platform-v7/control-tower',
      focus: 'видит главный блокер и ответственного',
      action: 'разобрать очередь снятия стопов',
    },
    {
      role: 'Покупатель',
      href: '/platform-v7/buyer',
      focus: 'видит, что резерв не равен выплате',
      action: 'проверить основание для оплаты',
    },
    {
      role: 'Водитель',
      href: '/platform-v7/driver/field',
      focus: 'видит один рейс и одно действие',
      action: 'закрыть полевой статус без лишнего текста',
    },
    {
      role: 'Банк',
      href: '/platform-v7/bank/release-safety',
      focus: 'видит документы, риск и основание',
      action: 'проверить возможность выпуска денег',
    },
  ],
  proofItems: [
    { label: 'Документы', text: 'СДИЗ, ЭТрН, акт расхождения и банковское основание сведены к сделке.' },
    { label: 'Деньги', text: 'Каждый стоп показывает сумму, причину, владельца и следующий шаг.' },
    { label: 'Статус зрелости', text: 'Controlled-pilot / pre-integration. Боевые подключения требуют доступов и договоров.' },
  ],
  maturityNotice: 'Без заявлений о live-интеграциях. Банк, ФГИС, ЭДО и ЭПД подключаются только после доступов, договоров и проверки на реальных сделках.',
  sourceMeta: {
    source: 'controlled-pilot-runtime-fixture',
    runtimeBound: true,
    liveExternalIntegrations: false,
  },
} satisfies Omit<PlatformV7EntryCockpitState, 'primaryBlocker'>;

export function getPlatformV7EntryCockpitState(): PlatformV7EntryCockpitState {
  const blockers = [...fixture.blockers];

  return {
    ...fixture,
    executionPath: [...fixture.executionPath],
    blockers,
    lanes: [...fixture.lanes],
    roleEntrypoints: [...fixture.roleEntrypoints],
    proofItems: [...fixture.proofItems],
    primaryBlocker: blockers[0] ?? null,
  };
}
