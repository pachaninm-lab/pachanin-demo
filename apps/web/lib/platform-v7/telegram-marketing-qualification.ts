import {
  buildOrganizationWaitlistUrl,
  type MarketingAttribution,
  type MarketingRoleCode,
  type MarketingScenarioCode,
} from './marketing-attribution';

const TAG_PATTERN = /^[A-Za-z0-9_-]{1,12}$/u;

export const TELEGRAM_ROLE_OPTIONS: readonly Readonly<{
  code: MarketingRoleCode;
  label: string;
}>[] = Object.freeze([
  { code: 'ps', label: 'Производитель / продавец' },
  { code: 'bp', label: 'Покупатель / переработчик' },
  { code: 'lg', label: 'Логистика / перевозчик' },
  { code: 'se', label: 'Элеватор / хранение' },
  { code: 'ls', label: 'Лаборатория / сюрвейер' },
  { code: 'bf', label: 'Банк / финансирование' },
  { code: 'pp', label: 'Отраслевой / гос. партнёр' },
]);

export const TELEGRAM_SCENARIO_OPTIONS: readonly Readonly<{
  code: MarketingScenarioCode;
  label: string;
}>[] = Object.freeze([
  { code: 'de', label: 'Сделка и расчёт' },
  { code: 'la', label: 'Логистика и приёмка' },
  { code: 'ql', label: 'Качество и лаборатория' },
  { code: 'do', label: 'Документы и доказательства' },
  { code: 'fs', label: 'Финансирование / расчёты' },
  { code: 'ei', label: 'Интеграции' },
]);

const ROLE_SET = new Set<MarketingRoleCode>(TELEGRAM_ROLE_OPTIONS.map((option) => option.code));
const SCENARIO_SET = new Set<MarketingScenarioCode>(TELEGRAM_SCENARIO_OPTIONS.map((option) => option.code));

function tag(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return TAG_PATTERN.test(normalized) ? normalized : fallback;
}

function isRole(value: string): value is MarketingRoleCode {
  return ROLE_SET.has(value as MarketingRoleCode);
}

function isScenario(value: string): value is MarketingScenarioCode {
  return SCENARIO_SET.has(value as MarketingScenarioCode);
}

export type TelegramQualificationSeed = Readonly<{
  campaign: string;
  content: string;
}>;

export type TelegramQualificationAction =
  | Readonly<{ type: 'ROLE'; roleCode: MarketingRoleCode; seed: TelegramQualificationSeed }>
  | Readonly<{
      type: 'SCENARIO';
      roleCode: MarketingRoleCode;
      scenarioCode: MarketingScenarioCode;
      seed: TelegramQualificationSeed;
    }>;

/** Telegram /start parameter: q1_<campaign>_<content>. Unknown input degrades to organic. */
export function parseTelegramStart(text: string): TelegramQualificationSeed {
  const match = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+q1_([A-Za-z0-9_-]{1,12})_([A-Za-z0-9_-]{1,12}))?\s*$/u.exec(
    String(text ?? '').trim(),
  );
  if (!match) return Object.freeze({ campaign: 'organic', content: 'bot' });
  return Object.freeze({
    campaign: tag(match[1], 'organic'),
    content: tag(match[2], 'bot'),
  });
}

export function roleCallbackData(roleCode: MarketingRoleCode, seed: TelegramQualificationSeed): string {
  return ['q1', 'r', roleCode, tag(seed.campaign, 'organic'), tag(seed.content, 'bot')].join(':');
}

export function scenarioCallbackData(
  roleCode: MarketingRoleCode,
  scenarioCode: MarketingScenarioCode,
  seed: TelegramQualificationSeed,
): string {
  return [
    'q1',
    's',
    roleCode,
    scenarioCode,
    tag(seed.campaign, 'organic'),
    tag(seed.content, 'bot'),
  ].join(':');
}

export function parseTelegramCallback(data: string): TelegramQualificationAction | null {
  const parts = String(data ?? '').split(':');
  if (parts[0] !== 'q1') return null;

  if (parts.length === 5 && parts[1] === 'r' && isRole(parts[2])) {
    return Object.freeze({
      type: 'ROLE',
      roleCode: parts[2],
      seed: Object.freeze({ campaign: tag(parts[3], 'organic'), content: tag(parts[4], 'bot') }),
    });
  }

  if (
    parts.length === 6
    && parts[1] === 's'
    && isRole(parts[2])
    && isScenario(parts[3])
  ) {
    return Object.freeze({
      type: 'SCENARIO',
      roleCode: parts[2],
      scenarioCode: parts[3],
      seed: Object.freeze({ campaign: tag(parts[4], 'organic'), content: tag(parts[5], 'bot') }),
    });
  }

  return null;
}

export function telegramRoleKeyboard(seed: TelegramQualificationSeed) {
  return {
    inline_keyboard: TELEGRAM_ROLE_OPTIONS.map((option) => [{
      text: option.label,
      callback_data: roleCallbackData(option.code, seed),
    }]),
  } as const;
}

export function telegramScenarioKeyboard(roleCode: MarketingRoleCode, seed: TelegramQualificationSeed) {
  return {
    inline_keyboard: TELEGRAM_SCENARIO_OPTIONS.map((option) => [{
      text: option.label,
      callback_data: scenarioCallbackData(roleCode, option.code, seed),
    }]),
  } as const;
}

export function qualifiedOrganizationWaitlistUrl(
  origin: string,
  action: Extract<TelegramQualificationAction, { type: 'SCENARIO' }>,
): string {
  const attribution: MarketingAttribution = Object.freeze({
    source: 'tg',
    campaign: action.seed.campaign,
    content: action.seed.content,
    roleCode: action.roleCode,
    scenarioCode: action.scenarioCode,
  });
  return buildOrganizationWaitlistUrl(origin, attribution);
}
