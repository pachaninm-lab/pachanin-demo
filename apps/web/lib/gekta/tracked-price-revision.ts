import { GEKTA_WORD_REVISION_NOTICE, type GektaDocumentContext } from './document-context';

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
].map(form => new RegExp(`^${form}$`, 'iu'));

const WORD_PRICE_PAIR = new RegExp(
  `(?:цена|стоимость|unit\\s+price|价格条款)[^\\[\\]\\r\\n]{0,75}\\s*` +
  `\\[Удалено \\(правка\\)\\]\\s*(?<prior>${RATE})\\s*\\[Конец правки\\]\\s*` +
  `\\[Вставлено \\(правка\\)\\]\\s*(?<proposed>${RATE})\\s*\\[Конец правки\\]`, 'giu',
);

function revisionQuestion(question: string): boolean {
  return /цен|\bprice\b|价格|旧价|建议价/iu.test(question)
    && /прав(?:к|ок)|изменен|поменял|черновик|redline|tracked|revision|修订/iu.test(question)
    && /согласова|предлож|прежн|старо|agreed|agreement|proposed|建议|约定/iu.test(question);
}

/** Cite a price revision without treating the Word markup as evidence of agreement. */
export function answerTrackedPriceRevision(
  question: string,
  documents: readonly GektaDocumentContext[],
  locale: 'ru' | 'en' | 'zh',
): string | null {
  if (documents.length !== 1) return null;
  const document = documents[0];
  if (!/\.docx$/iu.test(document.name)) return null;
  const text = document.text.trim();
  const exactQuestion = PRICE_QUESTIONS.some(pattern => pattern.test(question.trim()));
  const exactPair = exactQuestion && !document.truncated
    ? PENDING_PRICE_PAIRS.map(pattern => pattern.exec(text)?.groups).find(Boolean) : undefined;
  const wordPairs = !exactPair && (exactQuestion || revisionQuestion(question)) && text.startsWith(GEKTA_WORD_REVISION_NOTICE)
    ? [...text.matchAll(WORD_PRICE_PAIR)].map(match => match.groups!) : [];
  if (!exactPair && !wordPairs.length) return null;
  if (wordPairs.length > 1) {
    if (locale === 'en') return 'The file contains several tracked price changes. Specify the clause or lot to review.';
    if (locale === 'zh') return '文件中有多处价格修订，请确认要核对的条款或批次。';
    return 'В файле несколько правок цены. Чтобы выбрать нужную, уточни пункт договора или партию.';
  }
  const { prior, proposed } = exactPair ?? wordPairs[0];
  const name = document.name.replace(/[\p{C}\s]+/gu, ' ').trim();
  if (locale === 'en') {
    return `In “${name}”, the deleted value is ${prior}. The proposed value is ${proposed}. ${document.truncated ? 'The extract is incomplete. ' : ''}The tracked changes do not establish an agreed price.`;
  }
  if (locale === 'zh') {
    return `在《${name}》中，删除值为${prior}，拟议值为${proposed}。${document.truncated ? '摘录不完整。' : ''}这些修订不能证明价格已约定。`;
  }
  return `В файле «${name}» удаляемое значение — ${prior}. Предлагаемое значение — ${proposed}. ${document.truncated ? 'Показанный фрагмент неполный. ' : ''}По этим правкам согласованная цена не подтверждена.`;
}
