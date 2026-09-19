export type PlatformV7OpenStep = {
  id: string;
  title: string;
  text: string;
  href: string;
};

export type PlatformV7RolePreview = {
  role: string;
  href: string;
  sees: string;
  action: string;
};

export type PlatformV7OnboardingGate = {
  label: string;
  state: 'available' | 'requires-operator' | 'requires-agreement';
  text: string;
};

export type PlatformV7OpenWalkthroughState = {
  maturity: 'controlled-pilot' | 'pre-integration';
  externalMode: 'pre-integration';
  steps: PlatformV7OpenStep[];
  roles: PlatformV7RolePreview[];
  gates: PlatformV7OnboardingGate[];
};

export function getPlatformV7OpenWalkthroughState(): PlatformV7OpenWalkthroughState {
  return {
    maturity: 'controlled-pilot',
    externalMode: 'pre-integration',
    steps: [
      {
        id: 'price',
        title: 'Цена и допуск',
        text: 'Пользователь начинает не с витрины, а с условий сделки: культура, объём, базис, качество и допуски.',
        href: '/platform-v7/open',
      },
      {
        id: 'execution',
        title: 'Исполнение',
        text: 'Дальше видны документы, рейс, приёмка, качество, деньги и спорная часть в одной цепочке.',
        href: '/platform-v7/role-preview',
      },
      {
        id: 'access',
        title: 'Доступ к пилоту',
        text: 'Доступ открывается оператором после выбора роли и проверки, без обещаний боевых подключений.',
        href: '/platform-v7/onboarding',
      },
    ],
    roles: [
      {
        role: 'Продавец',
        href: '/platform-v7/seller',
        sees: 'стопы по документам, качеству и оплате',
        action: 'закрыть основание для расчёта',
      },
      {
        role: 'Покупатель',
        href: '/platform-v7/buyer',
        sees: 'резерв, риск и основание выпуска денег',
        action: 'проверить пакет до оплаты',
      },
      {
        role: 'Логистика',
        href: '/platform-v7/logistics',
        sees: 'рейс, ЭТрН и контроль подтверждения',
        action: 'довести рейс до доказуемого статуса',
      },
      {
        role: 'Банк',
        href: '/platform-v7/bank/release-safety',
        sees: 'документы, риск и блокирующие события',
        action: 'смотреть основание, а не обещание оплаты',
      },
    ],
    gates: [
      {
        label: 'Роль',
        state: 'available',
        text: 'Сначала выбирается роль и видимость данных.',
      },
      {
        label: 'Контур сделки',
        state: 'requires-operator',
        text: 'Оператор связывает роль с controlled-pilot сценарием.',
      },
      {
        label: 'Внешние подключения',
        state: 'requires-agreement',
        text: 'Банк, ФГИС, ЭДО и ЭПД остаются pre-integration до доступов и договоров.',
      },
    ],
  };
}
