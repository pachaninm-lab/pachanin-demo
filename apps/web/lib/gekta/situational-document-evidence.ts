import type { GektaLocale } from './content';
import type { GektaDocumentContext } from './document-context';
import { ARITHMETIC_NUMBER, ARITHMETIC_SCALE, arithmeticDecimal, parseSuppliedNumber } from './supplied-decimal';

type Turn = Readonly<{ role: 'user' | 'assistant'; text: string }>;
type Evidence = { operation: 'revised_ticket' | 'intake_payment_status'; answer: string };

const lotPattern = /(?:парти[яию]|(?<![a-z])lot|批次)\s*[№#:：]?\s*([a-zа-яё0-9]{1,20}-[a-zа-яё0-9]{1,16})(?![a-zа-яё0-9-])/giu;
const corrected = /исправл[её]н|уточн[её]н|corrected|更正/iu;
const rubles = '(?:₽|RUB|руб(?:лей|ля|ль)?\\.?|卢布)';
const rateUnit = '(?:т(?![а-яё])|тонну|t(?![a-z])|tonne|吨)';
const numberToken = '(?<![\\p{N}.,+−-])(?<number>'+ARITHMETIC_NUMBER+')';
const separator = '\\s*(?:[:：=—–]\\s*)?';

function lotFrom(text: string): string | null {
  const ids = new Set([...text.matchAll(lotPattern)].map(match => match[1].toUpperCase()));
  return ids.size === 1 ? [...ids][0] : null;
}

function fileLabel(document: GektaDocumentContext): string {
  return document.name.replace(/[\p{C}\s]+/gu,' ').trim();
}

function oneValue(text: string, patterns: readonly string[]): bigint | null {
  const found = patterns.flatMap(pattern => [...text.matchAll(new RegExp(pattern,'giu'))]);
  if (found.length !== 1) return null;
  return parseSuppliedNumber(found[0].groups!.number);
}

function massFrom(text: string, word: string): bigint | null {
  return oneValue(text,[word+separator+numberToken+'\\s*(?:тонн(?:а|ы)?|т|tonnes?|t|吨)(?!\\s*/|[a-zа-яё0-9])']);
}

function saidPrice(text: string): bigint | null {
  if (!/согласова|подтвер|confirmed|已确认/iu.test(text)
    || /не\s+(?:согласова|подтвер|окончател)|отмен|пересматри|отозва|предварительн|\b(?:not\s+(?:agreed|confirmed)|retracted|cancelled|canceled|superseded)\b|未确认|撤回|取消|(?:примерно|около)\s*\d|(?:если|\bif\b|假设)/iu.test(text)) return null;
  return oneValue(text,[
    numberToken+'\\s*'+rubles+'\\s*(?:/|за\\s+|per\\s+)'+rateUnit,
    '每吨\\s*'+numberToken+'\\s*卢布',
  ]);
}

function revisedTicket(
  question: string, documents: readonly GektaDocumentContext[], history: readonly Turn[], locale: GektaLocale,
): Evidence | null {
  if (!corrected.test(question)
    || !/(?:пересчитай|рублей|сумму|сумма|суммы|итог|сколько|recalculate|total|重算|金额)/iu.test(question)
    || !/(?:прежн|ранее|раньше|из истории|цену не меняй|confirmed earlier|previously|之前确认)/iu.test(question)
    || documents.length !== 1) return null;
  const document = documents[0];
  if (!corrected.test(document.text) || !/(?:талон|ticket|地磅单)/iu.test(document.text)) return null;
  const lot = lotFrom(document.text);
  const requestedLot = lotFrom(question);
  if (!requestedLot || !lot) return null;
  const name = fileLabel(document);
  const operation = 'revised_ticket';
  if (lot !== requestedLot) {
    return { operation, answer: locale === 'en' ? `${name} does not identify a unique match for lot ${requestedLot}. Provide the corrected ticket for that lot.`
      : locale === 'zh' ? `${name} 未能对应到唯一的批次 ${requestedLot}，请提供该批次的更正地磅单。`
      : `«${name}» не подтверждает вес партии ${requestedLot}. Прикрепи исправленный талон именно по этой партии.` };
  }
  if (document.truncated) {
    return { operation, answer: locale === 'en' ? `The extract from ${name} is incomplete. Provide the full corrected weigh ticket.`
      : locale === 'zh' ? `${name} 的摘录不完整，请提供完整更正地磅单。`
      : `«${name}»: фрагмент неполный. Прикрепи полный исправленный талон.` };
  }
  const mass = massFrom(document.text,'(?:вес\\s+нетто|масса\\s+нетто|нетто(?![а-яё])|net\\s+(?:weight|mass)|净重)');
  if (mass === null) {
    return { operation, answer: locale === 'en' ? `The net weight in ${name} is ambiguous or missing. Confirm the revised net weight for lot ${lot}.`
      : locale === 'zh' ? `${name} 中的净重有歧义或缺失。请确认批次 ${lot} 的更正净重。`
      : `В «${name}» нет однозначного значения нетто. Уточни актуальный вес нетто партии ${lot}.` };
  }
  const latestUser = [...history].reverse().find(turn => turn.role === 'user');
  const price = latestUser && lotFrom(latestUser.text) === lot ? saidPrice(latestUser.text) : null;
  const show = (value: bigint, denominator = ARITHMETIC_SCALE, decimals?: number) =>
    arithmeticDecimal(value, denominator, locale, decimals);
  const tonne = locale === 'zh' ? '吨' : locale === 'en' ? 't' : 'т';
  const total = price === null ? null : show(
    mass*price, ARITHMETIC_SCALE*ARITHMETIC_SCALE, 2,
  );
  const rounded = price !== null && mass * price % (ARITHMETIC_SCALE * ARITHMETIC_SCALE / BigInt(100)) !== BigInt(0);
  if (locale === 'en') {
    return { operation,answer:`The revised ticket ${name} records ${show(mass)} ${tonne} for lot ${lot}. ${total === null
      ? 'Please confirm the price per tonne for this lot.'
      : `At your stated price of ${show(price!)} RUB/t, the value is ${total} RUB${rounded ? ' to the nearest kopek' : ''}.`}` };
  }
  if (locale === 'zh') {
    return { operation,answer:`${name} 记载批次 ${lot} 的更正净重为 ${show(mass)} ${tonne}。${total === null
      ? '请确认本批次的吨单价。'
      : `按你给出的单价 ${show(price!)} 卢布/吨计算，总额${rounded ? '约' : ''}为 ${total} 卢布。`}` };
  }
  return { operation,answer:`Исправленный талон «${name}» даёт для партии ${lot} нетто ${show(mass)} ${tonne}. ${total === null
    ? 'Уточни подтверждённую цену за тонну этой партии.'
    : `По указанной тобой цене ${show(price!)} ₽/т итог составляет ${total} ₽${rounded ? ' с округлением до копеек' : ''}.`}` };
}

function intakePayment(question: string, documents: readonly GektaDocumentContext[], locale: GektaLocale): Evidence | null {
  if (locale !== 'ru' || !/акт[а-яё]*|выписк[а-яё]*/iu.test(question) || !/(?:деньги|оплат|зачислен|поступлен)/iu.test(question)
    || !/(?:подтвер|поступил|статус|видно|сверь|проверь|видна)/iu.test(question)) return null;
  const acceptance = documents.filter(document => /(?:^|[.\n])\s*акт\s+при[её]мки(?:[.\s]|$)/iu.test(document.text));
  if (acceptance.length !== 1) return null;
  const act = acceptance[0];
  const lot = lotFrom(act.text);
  if (!lot || (lotFrom(question) ?? lot) !== lot) return null;
  const bank = documents.filter(document => /(?:^|[.\n])\s*выписка\s+банка(?:[.\s]|$)/iu.test(document.text));
  const operation = 'intake_payment_status';
  if (act.truncated || bank.some(document => document.truncated)) {
    return { operation, answer: 'В приложении фрагмент неполный. Для сверки нужны полный акт и запись банка о зачислении по этой партии.' };
  }
  const mass = massFrom(act.text,'(?:^|[.\\n])\\s*принято');
  if (mass === null) return null;
  const massLine = `В акте «${fileLabel(act)}» указано, что по партии ${lot} принято ${arithmeticDecimal(mass,ARITHMETIC_SCALE,locale)} т.`;
  const matching = bank.filter(document => lotFrom(document.text) === lot);
  if (!matching.length && bank.length) {
    return { operation,answer:`${massLine} В приложенной выписке нет записи по той же партии. Уточни выписку для ${lot}.` };
  }
  const source = matching.length === 1 ? matching[0] : null;
  const amount = source && !/возврат|отмен[а-яё]|сторнирован/iu.test(source.text)
    ? oneValue(source.text,['(?:^|[.\\n])\\s*зачислено'+separator+numberToken+'\\s*'+rubles])
    : null;
  return { operation, answer: !source || amount === null || amount <= BigInt(0)
    ? `${massLine} Запись о зачислении не найдена. Для подтверждения оплаты нужна запись банка по этой партии.`
    : `${massLine} Зачисление ${arithmeticDecimal(amount,ARITHMETIC_SCALE,locale)} ₽ указано в «${fileLabel(source)}». Для полной сверки сопоставь зачисление с суммой договора.` };
}

/** Match document roles and consignment identifiers before making an evidence claim. */
export function verifyAgroAttachments(
  question: string, documents: readonly GektaDocumentContext[], history: readonly Turn[], locale: GektaLocale,
): Evidence | null {
  if (!documents.length) return null;
  return revisedTicket(question,documents,history,locale) ?? intakePayment(question,documents,locale);
}
