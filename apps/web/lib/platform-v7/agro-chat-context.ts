export type AgroChatHistoryTurn = Readonly<{
  role: 'user' | 'assistant';
  text: string;
}>;

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 2_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

const FOLLOW_UP_PREFIX = /^(?:а|и|но|тогда|ещ[её]|так|поэтому|при этом|а если|а для|а что|а как|а почему|а сколько|and|but|then|also|so|what about|how about|why exactly|那|那么|还有|如果|为什么)(?:\s|$|[?.!,])/iu;
const FOLLOW_UP_REFERENCE = /(?:^|\s)(?:это|этот|эта|эти|он|она|они|там|такой|такая|такие|выше|предыдущ\w*|последн\w*|подробнее|продолжи|дальше|именно|в этом случае|для него|для нее|для них|it|this|that|they|them|there|above|previous|continue|more detail|这个|那个|它|他们|继续|详细)(?:\s|$|[?.!,])/iu;
const BARE_FOLLOW_UP = /^(?:почему|зачем|как|сколько|когда|где|подробнее|продолжи|дальше|why|how|when|where|more|continue|为什么|怎么|何时|哪里|继续|详细)[?.!]?$/iu;

const PLATFORM_PATTERNS = [
  /(?:прозрачн\w*\s+цен\w*|transparent\s+price|透明价格)/iu,
  /(?:эта|данная|ваша|наша)\s+(?:платформа|система)|(?:this|your|our)\s+(?:platform|system)|(?:本|这个|你们的)(?:平台|系统)/iu,
  /(?:платформ\w*|личн\w*\s+кабинет|аккаунт\w*|сесси\w*|workspace\w*)/iu,
  /^(?:как\s+)?(?:зарегистрироваться|войти)(?:\s+(?:здесь|сюда))?[?.!]?$/iu,
  /(?:регистрац\w*|зарегистрир\w*|авторизац\w*|авторизова\w*|войти|вход\w*).{0,35}(?:платформ\w*|личн\w*\s+кабинет|аккаунт\w*)/iu,
  /^(?:как\s+работает\s+сделка|покажи\s+путь\s+сделки|какие\s+роли\s+участвуют(?:\s+в\s+сделке)?|как\s+защищаются\s+данные)[?.!]?$/iu,
  /(?:подключен\w*|доступн\w*|работает\s+ли).{0,35}(?:фгис\s*[«"']?зерно|эдо|1с\b|erp\b|tms\b|wms\b|lims\b|интеграц\w*)/iu,
  /(?:защищ\w*|безопасн\w*|конфиденц\w*).{0,40}(?:данн\w*|аккаунт\w*|кабинет\w*|сделк\w*)/iu,
  /(?:роль|роли|ролей|доступ\w*).{0,35}(?:платформ\w*|сделк\w*|пользовател\w*|кабинет\w*|организац\w*)/iu,
  /(?:tenant|rbac|mfa|outbox|аудит\w*\s+(?:платформ\w*|сделк\w*))/iu,
  /(?:что\s+(?:ты|вы)\s+уме\w*|возможност\w*\s+(?:ии|помощника)|what\s+can\s+you\s+do|你会做什么)/iu,
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function shouldCarryAgroChatHistory(question: string): boolean {
  const normalized = normalize(question);
  if (!normalized) return false;
  return FOLLOW_UP_PREFIX.test(normalized)
    || FOLLOW_UP_REFERENCE.test(normalized)
    || BARE_FOLLOW_UP.test(normalized);
}

export function selectAgroChatHistory(
  question: string,
  value: unknown,
): readonly AgroChatHistoryTurn[] {
  if (!shouldCarryAgroChatHistory(question) || !Array.isArray(value)) return Object.freeze([]);

  const turns: AgroChatHistoryTurn[] = [];
  let total = 0;
  for (const item of value.slice(-MAX_HISTORY_TURNS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const role = row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null;
    const text = typeof row.text === 'string'
      ? row.text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
        .slice(0, MAX_HISTORY_TURN_CHARS)
      : '';
    if (!role || !text) continue;
    if (total + text.length > MAX_HISTORY_TOTAL_CHARS) break;
    turns.push(Object.freeze({ role, text }));
    total += text.length;
  }
  return Object.freeze(turns);
}

export function isVerifiedPlatformQuestion(question: string): boolean {
  const normalized = normalize(question);
  return PLATFORM_PATTERNS.some((pattern) => pattern.test(normalized));
}
