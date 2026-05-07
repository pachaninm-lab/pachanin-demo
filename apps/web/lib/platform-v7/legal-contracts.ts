export type PlatformV7LegalMode = 'controlled_pilot' | 'real_requires_contracts' | 'disabled';

export type PlatformV7LegalRuleType =
  | 'deal_rules'
  | 'rating_rules'
  | 'dispute_rules'
  | 'money_hold_rules'
  | 'pilot_real_boundary'
  | 'anti_bypass_policy'
  | 'document_signing_rules'
  | 'external_connector_rules'
  | 'personal_data_rules'
  | 'tax_and_counterparty_rules';

export type PlatformV7LegalRule = {
  readonly type: PlatformV7LegalRuleType;
  readonly title: string;
  readonly mode: PlatformV7LegalMode;
  readonly requiredBeforeRealMode: boolean;
  readonly blocksMoneyRelease: boolean;
  readonly summary: string;
};

export const PLATFORM_V7_REQUIRED_LEGAL_RULES: readonly PlatformV7LegalRule[] = [
  {
    type: 'deal_rules',
    title: 'Правила сделки',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Фиксируют роли сторон, предмет сделки, порядок исполнения, документы, приёмку, основания удержаний и порядок закрытия сделки.',
  },
  {
    type: 'rating_rules',
    title: 'Правила рейтинга надёжности',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Определяют источники сигналов, порядок расчёта, право на исправление ошибки, границы видимости и запрет дискриминационного скоринга.',
  },
  {
    type: 'dispute_rules',
    title: 'Правила спора',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: true,
    summary: 'Определяют, какие доказательства принимаются, кто принимает решение, как фиксируется причина и как решение влияет на деньги.',
  },
  {
    type: 'money_hold_rules',
    title: 'Правила удержания денег',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: true,
    summary: 'Фиксируют основания удержания, срок, ответственного, связь с банком, спором и документами. Платформа не заменяет банк.',
  },
  {
    type: 'pilot_real_boundary',
    title: 'Граница пилотного и реального режима',
    mode: 'controlled_pilot',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Запрещает смешивать тестовый сценарий с реальными платежами, подписями и внешними подтверждениями без договоров и подключений.',
  },
  {
    type: 'anti_bypass_policy',
    title: 'Политика антиобхода',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Определяет запрет передачи контактов вне допустимого сценария, санкции, доказательства обхода и последствия для рейтинга и доступа.',
  },
  {
    type: 'document_signing_rules',
    title: 'Правила подписания документов',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: true,
    summary: 'Фиксируют КЭП, МЧД, полномочия подписанта, ЭДО и статус документа как основания для исполнения.',
  },
  {
    type: 'external_connector_rules',
    title: 'Правила внешних подключений',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Определяют, какие внешние статусы можно показывать, как хранится внешний ID и когда требуется ручная проверка.',
  },
  {
    type: 'personal_data_rules',
    title: 'Правила персональных данных',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: false,
    summary: 'Фиксируют состав данных, цели обработки, доступы, журналирование, сроки хранения и удаление.',
  },
  {
    type: 'tax_and_counterparty_rules',
    title: 'Налоговые и контрагентские правила',
    mode: 'real_requires_contracts',
    requiredBeforeRealMode: true,
    blocksMoneyRelease: true,
    summary: 'Фиксируют проверку контрагента, полномочий, НДС/без НДС, реквизитов и стоп-факторов до расчётов.',
  },
];

export const PLATFORM_V7_REAL_MODE_BLOCKERS = PLATFORM_V7_REQUIRED_LEGAL_RULES.filter(
  (rule) => rule.requiredBeforeRealMode,
).map((rule) => rule.type);

export function canPlatformV7EnterRealMode(acceptedRuleTypes: readonly PlatformV7LegalRuleType[]) {
  const missing = PLATFORM_V7_REQUIRED_LEGAL_RULES.filter(
    (rule) => rule.requiredBeforeRealMode && !acceptedRuleTypes.includes(rule.type),
  ).map((rule) => rule.type);

  return {
    allowed: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'real_requires_contracts' as const : 'controlled_pilot' as const,
  };
}

export function doesLegalRuleBlockMoney(ruleType: PlatformV7LegalRuleType): boolean {
  return Boolean(PLATFORM_V7_REQUIRED_LEGAL_RULES.find((rule) => rule.type === ruleType)?.blocksMoneyRelease);
}
