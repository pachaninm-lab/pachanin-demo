export type AssistantUnderstandingLocale = 'ru' | 'en' | 'zh';

export type AssistantQuestionUnderstanding = Readonly<{
  original: string;
  normalized: string;
  corrected: string;
  tokens: readonly string[];
  detectedLocale: AssistantUnderstandingLocale;
  corrections: readonly Readonly<{ from: string; to: string; confidence: number }>[];
  ambiguous: boolean;
}>;

const RU_KEYBOARD_TO_EN: Record<string, string> = {
  й: 'q', ц: 'w', у: 'e', к: 'r', е: 't', н: 'y', г: 'u', ш: 'i', щ: 'o', з: 'p',
  х: '[', ъ: ']', ф: 'a', ы: 's', в: 'd', а: 'f', п: 'g', р: 'h', о: 'j', л: 'k',
  д: 'l', ж: ';', э: "'", я: 'z', ч: 'x', с: 'c', м: 'v', и: 'b', т: 'n', ь: 'm',
  б: ',', ю: '.',
};
const EN_KEYBOARD_TO_RU = Object.fromEntries(Object.entries(RU_KEYBOARD_TO_EN).map(([ru, en]) => [en, ru]));

const DOMAIN_DICTIONARY = [
  'платформа', 'сделка', 'сделки', 'аукцион', 'ставка', 'победитель', 'лот', 'допуск',
  'логистика', 'перевозка', 'перевозчик', 'водитель', 'элеватор', 'приемка', 'приёмка',
  'лаборатория', 'протокол', 'качество', 'влажность', 'сорность', 'клейковина', 'масса',
  'документ', 'документы', 'договор', 'акт', 'накладная', 'сдиз', 'фгис', 'зерно', 'эдо',
  'деньги', 'оплата', 'выплата', 'резерв', 'расчет', 'расчёт', 'возврат', 'комиссия',
  'банк', 'номинальный', 'счет', 'счёт', 'кредит', 'финансирование', 'факторинг', 'лимит',
  'спор', 'претензия', 'доказательства', 'безопасность', 'роль', 'доступ', 'кабинет',
  'покупатель', 'продавец', 'оператор', 'комплаенс', 'арбитр', 'сюрвейер', 'руководитель',
  'регистрация', 'вход', 'пароль', 'интеграция', 'статус', 'этап', 'срок', 'риск',
  'помощник', 'поддержка', 'стоимость', 'тариф', 'внедрение', 'обучение', 'миграция',
  'аналитика', 'отчет', 'отчёт', 'дашборд', 'эффект', 'окупаемость', 'выгода', 'налог',
  'бухгалтерия', 'юридический', 'ответственность', 'масштабирование', 'доступность',
  'восстановление', 'производительность', 'маркетплейс', 'биржа', 'конкурент',
  'platform', 'deal', 'auction', 'bid', 'winner', 'lot', 'logistics', 'driver', 'elevator',
  'laboratory', 'quality', 'documents', 'payment', 'settlement', 'bank', 'dispute', 'evidence',
  'security', 'role', 'access', 'buyer', 'seller', 'support', 'integration', 'status', 'risk',
  'pricing', 'implementation', 'analytics', 'finance', 'legal', 'accounting', 'reliability',
] as const;

const COMMON_CORRECTIONS: Record<string, string> = {
  палучить: 'получить', палучю: 'получу', денги: 'деньги', деньгы: 'деньги',
  аплата: 'оплата', оплато: 'оплата', выплато: 'выплата', виплата: 'выплата',
  зделка: 'сделка', сделко: 'сделка', аукцыон: 'аукцион', аукционн: 'аукцион',
  приемка: 'приёмка', преемка: 'приёмка', лабаратория: 'лаборатория',
  документи: 'документы', дакументы: 'документы', догавор: 'договор',
  логистикаа: 'логистика', перевозкаа: 'перевозка', фгисзерно: 'фгис зерно',
  сдис: 'сдиз', сдизз: 'сдиз', номиналный: 'номинальный', счот: 'счёт',
  регестрация: 'регистрация', парол: 'пароль', памощник: 'помощник',
  стоимасть: 'стоимость', сколко: 'сколько', тарифф: 'тариф', внедренее: 'внедрение',
  окупаемасть: 'окупаемость', аналетика: 'аналитика', бухгалерия: 'бухгалтерия',
  юредический: 'юридический', безопастность: 'безопасность', интеграцыя: 'интеграция',
  маштабирование: 'масштабирование', производительнасть: 'производительность',
  podderzhka: 'поддержка', sdelka: 'сделка', dengi: 'деньги', oplata: 'оплата',
  stoimost: 'стоимость', vnedrenie: 'внедрение', kredit: 'кредит', bezopasnost: 'безопасность',
};

const SYNONYMS: Record<string, string> = {
  бабки: 'деньги', средства: 'деньги', платеж: 'оплата', платёж: 'оплата',
  заплатят: 'выплата', перечислят: 'выплата', расчет: 'расчёт',
  машинa: 'перевозка', машина: 'перевозка', фура: 'перевозка', грузовик: 'перевозка',
  склад: 'элеватор', зернохранилище: 'элеватор', анализ: 'лаборатория',
  бумага: 'документ', бумаги: 'документы', контракт: 'договор',
  жалоба: 'претензия', разбирательство: 'спор', входить: 'вход', залогиниться: 'вход',
  прайс: 'стоимость', цена: 'стоимость', расценки: 'тариф', внедрить: 'внедрение',
  подключить: 'интеграция', окупится: 'окупаемость', польза: 'выгода',
  отчеты: 'отчёт', отчёты: 'отчёт', метрики: 'аналитика', налоги: 'налог',
  безопасность: 'безопасность', надежность: 'надёжность', отказоустойчивость: 'надёжность',
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/[ё]/gu, 'е')
    .replace(/[^\p{L}\p{N}\s._-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function keyboardSwap(value: string, map: Record<string, string>): string {
  return [...value].map((char) => map[char] ?? char).join('');
}

function detectLocale(value: string, fallback: AssistantUnderstandingLocale): AssistantUnderstandingLocale {
  if (/\p{Script=Han}/u.test(value)) return 'zh';
  if (/[а-яё]/iu.test(value)) return 'ru';
  if (/[a-z]/iu.test(value)) return 'en';
  return fallback;
}

function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[a.length][b.length];
}

function bestDictionaryMatch(token: string): { value: string; confidence: number } | null {
  if (token.length < 4 || /^\d+$/u.test(token)) return null;
  let best = token;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of DOMAIN_DICTIONARY) {
    if (Math.abs(candidate.length - token.length) > 2) continue;
    const current = distance(token, candidate);
    if (current < bestDistance) { best = candidate; bestDistance = current; }
  }
  const threshold = token.length <= 5 ? 1 : token.length <= 9 ? 2 : 3;
  if (bestDistance > threshold || best === token) return null;
  return { value: best, confidence: Math.max(0.55, 1 - bestDistance / Math.max(token.length, best.length)) };
}

function chooseKeyboardVariant(value: string): string {
  if (!value) return value;
  const ruToEn = normalize(keyboardSwap(value, RU_KEYBOARD_TO_EN));
  const enToRu = normalize(keyboardSwap(value, EN_KEYBOARD_TO_RU));
  const score = (candidate: string) => DOMAIN_DICTIONARY.reduce((sum, term) => sum + (candidate.includes(term) ? term.length : 0), 0);
  return [value, ruToEn, enToRu].sort((a, b) => score(b) - score(a))[0];
}

export function understandAssistantQuestion(input: string, fallbackLocale: AssistantUnderstandingLocale = 'ru'): AssistantQuestionUnderstanding {
  const original = input.slice(0, 4_000);
  const normalized = chooseKeyboardVariant(normalize(original));
  const sourceTokens = normalized.split(' ').filter(Boolean).slice(0, 120);
  const corrections: Array<{ from: string; to: string; confidence: number }> = [];
  const correctedTokens = sourceTokens.flatMap((token) => {
    const explicit = COMMON_CORRECTIONS[token];
    if (explicit) { corrections.push({ from: token, to: explicit, confidence: 0.99 }); return explicit.split(' '); }
    const synonym = SYNONYMS[token];
    if (synonym) return [synonym];
    const fuzzy = bestDictionaryMatch(token);
    if (fuzzy) { corrections.push({ from: token, to: fuzzy.value, confidence: fuzzy.confidence }); return [fuzzy.value]; }
    return [token];
  });
  const corrected = correctedTokens.join(' ');
  const lowConfidenceCorrections = corrections.filter((item) => item.confidence < 0.7).length;
  return {
    original, normalized, corrected, tokens: correctedTokens,
    detectedLocale: detectLocale(corrected, fallbackLocale), corrections,
    ambiguous: correctedTokens.length === 0 || lowConfidenceCorrections > 1,
  };
}
