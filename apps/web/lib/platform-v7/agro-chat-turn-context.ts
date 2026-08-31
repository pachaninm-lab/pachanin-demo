export type AgroChatTurn = Readonly<{
  role: 'user' | 'assistant';
  text: string;
}>;

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 2_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

const FOLLOW_UP_PREFIX = /^(?:а|и|но|тогда|ещ[её]|так|поэтому|при этом|а если|а для|а что|а как|а почему|а сколько|and|but|then|also|so|what about|how about|why exactly|那|那么|还有|如果|为什么)(?:\s|$|[?.!,])/iu;
const FOLLOW_UP_REFERENCE = /(?:^|\s)(?:это|этот|эта|эти|он|она|они|там|такой|такая|такие|выше|предыдущ\w*|последн\w*|подробнее|продолжи|дальше|именно|в этом случае|для него|для нее|для них|it|this|that|they|them|there|above|previous|continue|more detail|这个|那个|它|他们|继续|详细)(?:\s|$|[?.!,])/iu;
const BARE_FOLLOW_UP = /^(?:почему|зачем|как|сколько|когда|где|подробнее|продолжи|дальше|why|how|when|where|more|continue|为什么|怎么|何时|哪里|继续|详细)[?.!]?$/iu;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function isExplicitAgroFollowUp(question: string): boolean {
  const normalized = normalize(question);
  if (!normalized) return false;
  return FOLLOW_UP_PREFIX.test(normalized)
    || FOLLOW_UP_REFERENCE.test(normalized)
    || BARE_FOLLOW_UP.test(normalized);
}

export function selectTurnSafeAgroHistory(
  question: string,
  value: unknown,
): readonly AgroChatTurn[] {
  if (!isExplicitAgroFollowUp(question) || !Array.isArray(value)) return Object.freeze([]);

  const newestFirst: AgroChatTurn[] = [];
  let total = 0;
  for (const item of [...value.slice(-MAX_HISTORY_TURNS)].reverse()) {
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
    if (!role || !text || total + text.length > MAX_HISTORY_TOTAL_CHARS) continue;
    newestFirst.push(Object.freeze({ role, text }));
    total += text.length;
  }
  return Object.freeze(newestFirst.reverse());
}