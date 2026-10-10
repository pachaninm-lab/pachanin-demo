import {
  buildOrganizationWaitlistUrl,
  type MarketingAttribution,
  type MarketingRoleCode,
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

function tag(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return TAG_PATTERN.test(normalized) ? normalized : fallback;
}

export type TelegramQualificationSeed = Readonly<{
  campaign: string;
  content: string;
}>;

export type MarketingAttributionSigner = (attribution: MarketingAttribution) => string;

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

/**
 * Inline URL buttons keep qualification stateless: Telegram never sends us the
 * user's role choice. Every attribution URL also carries a server-generated
 * HMAC token; unsigned query parameters remain presentation-only hints.
 */
export function telegramRoleUrlKeyboard(
  origin: string,
  seed: TelegramQualificationSeed,
  signAttribution: MarketingAttributionSigner,
) {
  return {
    inline_keyboard: TELEGRAM_ROLE_OPTIONS.map((option) => {
      const attribution: MarketingAttribution = Object.freeze({
        source: 'tg',
        campaign: tag(seed.campaign, 'organic'),
        content: tag(seed.content, 'bot'),
        roleCode: option.code,
      });
      const signedAttributionToken = signAttribution(attribution);
      return [{
        text: option.label,
        url: buildOrganizationWaitlistUrl(origin, attribution, signedAttributionToken),
      }];
    }),
  } as const;
}
