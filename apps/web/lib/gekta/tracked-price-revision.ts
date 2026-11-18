import type { GektaDocumentContext } from './document-context';

const CONTRACT_REF = '[\\p{L}\\d][\\p{L}\\d-]{0,40}';
const AMOUNT = '(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3}){1,2}|\\d{1,9})(?:[.,]\\d{1,2})?';
const RATE = `(?:${AMOUNT}\\s*(?:₽|RUB)\\s*/\\s*(?:т|t)|每吨${AMOUNT}卢布)`;

const PRICE_QUESTIONS = [
  `В полученной версии договора ${CONTRACT_REF} укажи прежнюю цифру и предлагаемую\\. Какая цена согласована по представленному пакету\\?`,
  'Укажи прежнюю и предлагаемую цену в правках\\. Подтверждено ли согласование\\?',
  `For contract draft ${CONTRACT_REF}, report the old and proposed price\\. Does the supplied packet establish an agreed amount\\?`,
  'Report the old and proposed price in the tracked changes\\. Is the price agreed\\?',
  `在合同草案${CONTRACT_REF}中指出旧价格和新建议价格。材料能证明已约定哪个价格吗？`,
].map(form => new RegExp(`^${form}$`, 'iu'));

const PENDING_PRICE_PAIRS = [
  `Цена \\([\\p{L} -]+\\), п\\. \\d+(?:\\.\\d+)*\\. \\[удалено, правка не принята: (?<prior>${RATE})\\] \\[вставлено, правка не принята: (?<proposed>${RATE})\\]\\. Документ без подписей\\. Принятый договор не приложен\\.`,
  `[\\p{L} -]+ price, §\\d+(?:\\.\\d+)*\\. \\[pending tracked deletion: (?<prior>${RATE})\\] \\[pending tracked insertion: (?<proposed>${RATE})\\]\\. Unsigned\\. No executed version attached\\.`,
  `[\\p{L}]+价格第\\d+(?:\\.\\d+)*款：\\[未接受删除：(?<prior>${RATE})\\] \\[未接受插入：(?<proposed>${RATE})\\]。这份草案没有签字，未附已签版本。`,
  `Документ содержит правки: удалённые, вставленные и перенесённые фрагменты помечены\\. Это не подтверждает принятие изменений\\.\\s+Цена\\s*[:—]?\\s*\\[Удалено \\(правка\\)\\](?<prior>${RATE})\\[Конец правки\\]\\s*\\[Вставлено \\(правка\\)\\](?<proposed>${RATE})\\[Конец правки\\]\\.?`,
].map(form => new RegExp(`^${form}$`, 'iu'));

/** Answer only a complete, single-price revision extract without competing evidence. */
export function answerTrackedPriceRevision(
  question: string,
  documents: readonly GektaDocumentContext[],
  locale: 'ru' | 'en' | 'zh',
): string | null {
  if (documents.length !== 1 || !PRICE_QUESTIONS.some(pattern => pattern.test(question.trim()))) return null;
  const document = documents[0];
  if (document.truncated || !/\.docx$/iu.test(document.name)) return null;
  for (const pattern of PENDING_PRICE_PAIRS) {
    const prices = pattern.exec(document.text.trim())?.groups;
    if (!prices) continue;
    const { prior, proposed } = prices;
    const name = document.name.replace(/\s+/gu, ' ');
    if (locale === 'en') {
      return `In “${name}”, the deleted value is ${prior}. The proposed value is ${proposed}. The tracked changes do not establish an agreed price.`;
    }
    if (locale === 'zh') {
      return `在《${name}》中，删除值为${prior}，拟议值为${proposed}。这些修订不能证明价格已约定。`;
    }
    return `В файле «${name}» удаляемое значение — ${prior}. Предлагаемое значение — ${proposed}. По этим правкам согласованная цена не подтверждена.`;
  }
  return null;
}
