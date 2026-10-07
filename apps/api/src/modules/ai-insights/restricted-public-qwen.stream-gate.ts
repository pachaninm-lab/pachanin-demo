/**
 * The commit gate that turns model deltas into publishable text.
 *
 * The buffered generator could apply every safety rule at once because it held
 * the whole answer. Streaming does not have that luxury, and the tempting
 * shortcut — generate fully, then release in slices — is not streaming at all:
 * the reader still waits for the last token before seeing the first word.
 *
 * So the gate releases text as the model produces it, but only text it can
 * already decide on. Verified-platform and current-evidence answers still wait
 * for syntactically complete blocks because those policies need a whole block.
 * Plain general-agro prose may additionally release a completed word-bounded
 * prefix once it is long enough to be useful. That path keeps a safety
 * lookbehind across fragments, never cuts through a token, and retains every
 * fail-closed rule that applies to the eventual sentence.
 *
 * Two rules genuinely cannot be block-local: a completeness floor exists because
 * the *whole* answer was thin, and a truncation notice describes how generation
 * ended. Those run at flush, where they are appends rather than retractions.
 */
import {
  CROP_PROTECTION_NAMED_PRODUCT_PRELUDE_PATTERN,
  CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN,
  currentEvidenceVerdict,
  groundingAuthority,
  isUngroundedCropProtectionPrescription,
  platformGroundingVerdict,
  sanitizeAnswer,
  splitAnswerBlocks,
  stripRawLinks,
  SECRET_PATTERN,
  WRITE_CLAIM_PATTERN,
  type PublicAnswerMode,
  type PublicLocale,
  type PublicGrounding,
} from './restricted-public-qwen.safety';
import { stripInternalModelTrace, undecidedTailStart } from './restricted-public-qwen.internal-trace';

/** Why the gate refused the answer outright. Both are fail-closed. */
export type GateViolation = 'WRITE_CLAIM' | 'SECRET' | 'OUTPUT_LIMIT';

export interface GateCommit {
  /** Text safe to put on the wire now. Empty when nothing became decidable. */
  readonly text: string;
  readonly flags: readonly string[];
  /** Non-null once the answer must be refused rather than continued. */
  readonly violation: GateViolation | null;
}

export interface StreamingAnswerGateOptions {
  readonly answerMode: PublicAnswerMode;
  readonly locale: PublicLocale;
  readonly currentDataRequired: boolean;
  readonly grounding: PublicGrounding;
  readonly economicComparison?: EconomicComparison | null;
  /**
   * Bound on withheld text. A model that never emits a sentence terminator must
   * not grow an unbounded buffer, so beyond this the gate commits at the last
   * word boundary instead of waiting. Safety rules still run on what it commits.
   */
  readonly maxPendingChars?: number;
}

const DEFAULT_MAX_PENDING_CHARS = 3_000;
const BLOCK_BOUNDARY = /(?:[.!?]\s|[。！？]|\n)\s*$/u;
/**
 * A progressive fragment shorter than this is rarely useful to a reader and
 * increases frame churn. 48 characters is deliberately independent of locale
 * and model tokenization; it is a transport threshold, not answer semantics.
 */
const GENERAL_AGRO_PROGRESSIVE_MIN_CHARS = 48;
/**
 * WRITE_CLAIM has at most 40 arbitrary characters between actor and action.
 * A 320-character lookbehind also covers the longest crop-prescription pattern
 * across progressive fragments; secret signatures are shorter.
 */
const PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS = 320;
const HAN_CHARACTER = /\p{Script=Han}/u;
const CHINESE_PRESCRIPTION_PREFIX = /(?:使用|施用|选择|推荐)[^.!?。！？\n]{0,200}$|[使施选推]$/u;

const EMPTY_COMMIT: GateCommit = Object.freeze({ text: '', flags: Object.freeze([]), violation: null });

/** Named references that can affect ASCII/Cyrillic safety tokens or whitespace.
 * HTML5 names from Python's standard html.entities table; unrelated Unicode
 * references cannot form these signatures. Numeric references cover all scripts.
 */
const SALE_SAFETY_CHARACTER_REFERENCES: Readonly<Record<string, string>> = Object.freeze({
  "Acy;": "А",
  "acy;": "а",
  "AMP": "&",
  "amp": "&",
  "AMP;": "&",
  "amp;": "&",
  "apos;": "'",
  "ast;": "*",
  "Bcy;": "Б",
  "bcy;": "б",
  "bsol;": "\\",
  "CHcy;": "Ч",
  "chcy;": "ч",
  "colon;": ":",
  "comma;": ",",
  "commat;": "@",
  "Dcy;": "Д",
  "dcy;": "д",
  "DiacriticalGrave;": "`",
  "DJcy;": "Ђ",
  "djcy;": "ђ",
  "dollar;": "$",
  "DScy;": "Ѕ",
  "dscy;": "ѕ",
  "DZcy;": "Џ",
  "dzcy;": "џ",
  "Ecy;": "Э",
  "ecy;": "э",
  "emsp13;": " ",
  "emsp14;": " ",
  "emsp;": " ",
  "ensp;": " ",
  "equals;": "=",
  "excl;": "!",
  "Fcy;": "Ф",
  "fcy;": "ф",
  "fjlig;": "fj",
  "Gcy;": "Г",
  "gcy;": "г",
  "GJcy;": "Ѓ",
  "gjcy;": "ѓ",
  "grave;": "`",
  "GT": ">",
  "gt": ">",
  "GT;": ">",
  "gt;": ">",
  "hairsp;": " ",
  "HARDcy;": "Ъ",
  "hardcy;": "ъ",
  "Hat;": "^",
  "Icy;": "И",
  "icy;": "и",
  "IEcy;": "Е",
  "iecy;": "е",
  "IOcy;": "Ё",
  "iocy;": "ё",
  "Iukcy;": "І",
  "iukcy;": "і",
  "Jcy;": "Й",
  "jcy;": "й",
  "Jsercy;": "Ј",
  "jsercy;": "ј",
  "Jukcy;": "Є",
  "jukcy;": "є",
  "Kcy;": "К",
  "kcy;": "к",
  "KHcy;": "Х",
  "khcy;": "х",
  "KJcy;": "Ќ",
  "kjcy;": "ќ",
  "lbrace;": "{",
  "lbrack;": "[",
  "lcub;": "{",
  "Lcy;": "Л",
  "lcy;": "л",
  "LJcy;": "Љ",
  "ljcy;": "љ",
  "lowbar;": "_",
  "lpar;": "(",
  "lsqb;": "[",
  "LT": "<",
  "lt": "<",
  "LT;": "<",
  "lt;": "<",
  "Mcy;": "М",
  "mcy;": "м",
  "MediumSpace;": " ",
  "midast;": "*",
  "nbsp": " ",
  "nbsp;": " ",
  "Ncy;": "Н",
  "ncy;": "н",
  "NewLine;": "\n",
  "NJcy;": "Њ",
  "njcy;": "њ",
  "NonBreakingSpace;": " ",
  "num;": "#",
  "numsp;": " ",
  "Ocy;": "О",
  "ocy;": "о",
  "Pcy;": "П",
  "pcy;": "п",
  "percnt;": "%",
  "period;": ".",
  "plus;": "+",
  "puncsp;": " ",
  "quest;": "?",
  "QUOT": "\"",
  "quot": "\"",
  "QUOT;": "\"",
  "quot;": "\"",
  "rbrace;": "}",
  "rbrack;": "]",
  "rcub;": "}",
  "Rcy;": "Р",
  "rcy;": "р",
  "rpar;": ")",
  "rsqb;": "]",
  "Scy;": "С",
  "scy;": "с",
  "semi;": ";",
  "SHCHcy;": "Щ",
  "shchcy;": "щ",
  "SHcy;": "Ш",
  "shcy;": "ш",
  "SOFTcy;": "Ь",
  "softcy;": "ь",
  "sol;": "/",
  "Tab;": "\t",
  "Tcy;": "Т",
  "tcy;": "т",
  "ThickSpace;": "  ",
  "thinsp;": " ",
  "ThinSpace;": " ",
  "TScy;": "Ц",
  "tscy;": "ц",
  "TSHcy;": "Ћ",
  "tshcy;": "ћ",
  "Ubrcy;": "Ў",
  "ubrcy;": "ў",
  "Ucy;": "У",
  "ucy;": "у",
  "UnderBar;": "_",
  "Vcy;": "В",
  "vcy;": "в",
  "verbar;": "|",
  "vert;": "|",
  "VerticalLine;": "|",
  "VeryThinSpace;": " ",
  "YAcy;": "Я",
  "yacy;": "я",
  "Ycy;": "Ы",
  "ycy;": "ы",
  "YIcy;": "Ї",
  "yicy;": "ї",
  "YUcy;": "Ю",
  "yucy;": "ю",
  "Zcy;": "З",
  "zcy;": "з",
  "ZHcy;": "Ж",
  "zhcy;": "ж"
});
const SALE_SAFETY_LEGACY_REFERENCES = Object.freeze(Object.keys(SALE_SAFETY_CHARACTER_REFERENCES)
  .filter((name) => !name.endsWith(';')).sort((left, right) => right.length - left.length));

/** Preserve unfinished references across cuts; canonicalize numeric tails so
 * arbitrarily many leading zeros cannot evict the safety lookbehind.
 */
function decodeSaleCharacterReferences(text: string, final: boolean): string {
  return text.replace(/&#(?:[xX]([0-9a-fA-F]*)|([0-9]+))(;?)|&([A-Za-z][A-Za-z0-9]{0,31})(;?)/gu,
    (reference: string, hex: string | undefined, decimal: string | undefined, numericSemicolon: string | undefined,
      name: string | undefined, namedSemicolon: string | undefined, offset: number) => {
      if (name !== undefined) {
        const exactName = name + (namedSemicolon ?? '');
        if (Object.hasOwn(SALE_SAFETY_CHARACTER_REFERENCES, exactName)) {
          if (!namedSemicolon && !final && offset + reference.length === text.length) return reference;
          return SALE_SAFETY_CHARACTER_REFERENCES[exactName];
        }
        const legacy = SALE_SAFETY_LEGACY_REFERENCES.find((prefix) => name.startsWith(prefix));
        return legacy ? SALE_SAFETY_CHARACTER_REFERENCES[legacy] + name.slice(legacy.length) + (namedSemicolon ?? '') : reference;
      }
      const rawDigits = hex ?? decimal ?? '';
      if (!rawDigits) return reference;
      const base = hex !== undefined ? 16 : 10;
      const digits = rawDigits.replace(/^0+/u, '') || '0';
      const value = digits.length > 8 ? 0x110000 : Math.min(parseInt(digits, base), 0x110000);
      if (!numericSemicolon && !final && offset + reference.length === text.length) {
        return '&#' + (base === 16 ? 'x' : '') + value.toString(base);
      }
      return String.fromCodePoint(value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) ? 0xfffd : value);
    });
}



type SaleTagScanState = { inside: boolean; quote: string; prefix: string; comment: boolean; dashes: number };
function newSaleTagScanState(): SaleTagScanState {
  return { inside: false, quote: '', prefix: '', comment: false, dashes: 0 };
}

/** One bounded lexical pass: quoted attribute delimiters and HTML comments
 * cannot end a tag early or turn its contents into visible token fragments.
 */
function saleTextWithoutTagBoundaries(text: string, state: SaleTagScanState, separate: boolean): string {
  let result = '';
  for (const character of text) {
    if (!state.inside) {
      if (character !== '<') { result += character; continue; }
      Object.assign(state, newSaleTagScanState(), { inside: true });
      if (separate) result += ' ';
      continue;
    }
    if (state.prefix.length < 3) {
      state.prefix += character;
      if (state.prefix === '!--') state.comment = true;
    }
    if (state.comment) {
      if (character === '-') { state.dashes = Math.min(2, state.dashes + 1); continue; }
      if (character === '>' && state.dashes === 2) {
        Object.assign(state, newSaleTagScanState());
        if (separate) result += ' ';
      } else state.dashes = 0;
      continue;
    }
    if (state.quote) {
      if (character === state.quote) state.quote = '';
    } else if (character === '"' || character === "'") {
      state.quote = character;
    } else if (character === '>') {
      Object.assign(state, newSaleTagScanState());
      if (separate) result += ' ';
    }
  }
  return result;
}


export type EconomicComparison = 'storage' | 'transport' | 'payment_timing' | 'sale_proceeds' | 'qualitative';
export type SaleProceedsInput = Readonly<{
  quantityMilliTonnes: number;
  priceMinorPerTonne: number;
  deliveryMinor: number;
  grossMinor: number;
  proceedsMinor: number;
}>;

const SALE_PROCEEDS_TOPIC = /выручк|revenue|proceeds|销售收入|净收入/iu;
const SALE_NUMBER = '(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d{1,9})(?:[.,]\\d{1,3})?';
const SALE_RUB = '(?:руб(?:лей|ля|ль)?\\.?|₽|RUB|卢布)';

/** Same-turn, explicitly priced tonnes less one total delivery charge; never a profit forecast. */
export function saleProceedsFromUser(question: string): SaleProceedsInput | null {
  if (question.length > 1_200 || !SALE_PROCEEDS_TOPIC.test(question)) return null;
  // Extra inputs, alternatives, negation and non-RUB currencies need clarification.
  if (/[-−–—]\s*\d|%|процент|percent|税|налог|tax|НДС|VAT|USD|EUR|GBP|CNY|доллар|евро|юань|美元|欧元|[$€£]|(?:^|[^\p{L}])не(?:т)?(?=$|[^\p{L}])|\b(?:not|unknown|or)\b|неизвест|или|либо|不是|未知|或者/iu.test(question)) return null;
  // English ton/tons can mean short or long tons; require explicit metric units.
  const quantities = [...question.matchAll(new RegExp(`(${SALE_NUMBER})\\s*(?:тонн(?:а|ы|у|е)?|tonnes?|吨)(?![\\p{L}])`, 'giu'))];
  const prices = [...question.matchAll(new RegExp(`(${SALE_NUMBER})\\s*${SALE_RUB}\\s*(?:за\\s*тонн[уы]|/\\s*(?:т(?:онн[уы])?|tonnes?|吨)|per\\s*tonne)(?![\\p{L}])`, 'giu'))];
  const delivery = [...question.matchAll(new RegExp(`(?:доставка|стоимость\\s+доставки|delivery(?:\\s+cost)?|运输费|运费)\\s*[:：]?\\s*(${SALE_NUMBER})\\s*${SALE_RUB}(?![\\p{L}])`, 'giu'))];
  if (quantities.length !== 1 || prices.length !== 1 || delivery.length !== 1) return null;
  // Three trailing digits after a comma/dot can be fractional tonnes or a
  // thousands group. Without notation authority, ask for clarification. A
  // single zero before the decimal dot is an explicit sub-tonne fraction.
  const quantityNotation = quantities[0][1].replace(/[ \u00a0\u202f]/gu, '');
  if (/[.,]\d{3}$/u.test(quantityNotation) && !/^0\.\d{3}$/u.test(quantityNotation)) return null;
  const deliveryEnd = delivery[0].index! + delivery[0][0].length;
  // Only the matched delivery charge is a cost input. Other cost-qualified
  // quantities or quotes must not be promoted to commodity sale prices.
  const saleContext = question.slice(0, delivery[0].index!) + question.slice(deliveryEnd);
  if (/стоимост|себестоим|затрат|расход|хранени|тариф|погруз|перевоз|аренд|сушк|очистк|закуп|покуп|приобр|плата\s+за|\b(?:costs?|expenses?|storage|freight|transport(?:ation)?|haulage|loading|drying|rental|processing|purchase|buy(?:ing)?|procurement)\b|成本|费用|仓储|储存|装卸|租|烘干|采购/iu.test(saleContext)) return null;
  const quantityEnd = quantities[0].index! + quantities[0][0].length;
  const priceStart = prices[0].index!;
  // Bind this price to this quantity, rather than borrowing another commodity's quote.
  if (priceStart <= quantityEnd
    || !/^\s*(?:по|at|(?:[,，;]\s*)?(?:цена|price|价格)\s*[:：]?)\s*$/iu.test(question.slice(quantityEnd, priceStart))) return null;
  // Authoritative money output accepts a small declarative sale/input grammar,
  // not arbitrary prose containing these three numbers. Unknown acquisition,
  // expense or contextual wording requires clarification rather than a guessed
  // sale-price interpretation. Keep the full delivery charge out of this grammar.
  const priceEnd = priceStart + prices[0][0].length;
  const quoteSpan = question.slice(quantities[0].index!, priceEnd);
  const context = question.replace(quoteSpan, '').replace(delivery[0][0], '');
  const saleWords = /(?<![\p{L}])(?:посчитай(?:те)?|рассчитай(?:те)?|покажи(?:те)?|итогов(?:ую|ая|ой)|чистую|выручк[ауи]|после\s+доставки|от\s+(?:пере)?продажи|расч[её]т|продаю|продам|прода[её]м|и|пшениц[ауые]|кукуруз[ауы]|ячмен[ьия]|рожь|рис|рапс|со[яюи]|подсолнечник[ау]?|calculate|compute|show|total|net|revenue|proceeds|after\s+delivery|calculation|result|sell|selling|and|wheat|corn|maize|barley|rye|rice|canola|soy(?:beans?)?|sunflower)(?![\p{L}])|小麦|玉米|大麦|黑麦|水稻|油菜|大豆|向日葵|计算|净收入|销售收入|总收入|结果|展示|出售|卖出/giu;
  if (!/^[\s:：,.!？?。！;，]*$/u.test(context.replace(saleWords, ''))) return null;
  // A delivery charge for one crop cannot be subtracted from another crop's
  // sale. Repeated names/translations of the same crop are one identity.
  const cropKinds = [
    /(?<![\p{L}])(?:пшениц[ауые]|wheat)(?![\p{L}])|小麦/iu,
    /(?<![\p{L}])(?:кукуруз[ауы]|corn|maize)(?![\p{L}])|玉米/iu,
    /(?<![\p{L}])(?:ячмен[ьия]|barley)(?![\p{L}])|大麦/iu,
    /(?<![\p{L}])(?:рожь|rye)(?![\p{L}])|黑麦/iu,
    /(?<![\p{L}])(?:рис|rice)(?![\p{L}])|水稻/iu,
    /(?<![\p{L}])(?:рапс|canola)(?![\p{L}])|油菜/iu,
    /(?<![\p{L}])(?:со[яюи]|soy(?:beans?)?)(?![\p{L}])|大豆/iu,
    /(?<![\p{L}])(?:подсолнечник[ау]?|sunflower)(?![\p{L}])|向日葵/iu,
  ];
  if (cropKinds.filter((crop) => crop.test(question)).length > 1) return null;
  if (/примерн|около|приблиз|[~≈]|\b(?:about|approx(?:imately)?|roughly)\b|大约|约/iu.test(question)) return null;
  const numbers = [...question.matchAll(new RegExp(SALE_NUMBER, 'gu'))];
  if (numbers.length !== 3) return null;
  // Remove the explicit unit sale quote; every remaining recurring/per-unit
  // qualifier needs a total charge, whether before or after delivery and
  // whether separated from its amount by punctuation or a sentence boundary.
  const deliveryContext = question.slice(0, priceStart) + question.slice(priceStart + prices[0][0].length);
  if (/кажд|ежемесяч|ежеднев|еженедел|ежегод|\b(?:per|each|monthly|daily|weekly|yearly)\b|в\s+(?:месяц|день|неделю|год)|за\s+(?:один\s+)?(?:рейс|тонн|месяц|день|неделю|год)|на\s+(?:рейс|месяц)|\/|每|按(?:趟|车|月|天)/iu.test(deliveryContext)) return null;
  const scaled = (raw: string, decimals: number): bigint | null => {
    const value = raw.replace(/[ \u00a0\u202f]/gu, '').replace(',', '.');
    if (!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${decimals}})?$`, 'u').test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  };
  const quantity = scaled(quantities[0][1], 3);
  const price = scaled(prices[0][1], 2);
  const cost = scaled(delivery[0][1], 2);
  if (quantity === null || price === null || cost === null || quantity <= 0n || price <= 0n) return null;
  const product = quantity * price;
  // Do not silently round fractional kopecks or exceed the public safe-integer range.
  if (product % 1_000n !== 0n) return null;
  const gross = product / 1_000n;
  const proceeds = gross - cost;
  const values = [quantity, price, cost, gross, proceeds];
  if (values.some((value) => value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))) return null;
  return Object.freeze({ quantityMilliTonnes: Number(quantity), priceMinorPerTonne: Number(price), deliveryMinor: Number(cost), grossMinor: Number(gross), proceedsMinor: Number(proceeds) });
}

/** Recognize an attempted calculation even when its inputs need clarification. */
function saleCalculationRequested(question: string): boolean {
  // Chinese sale amount questions can separate the sale verb and income noun
  // with the commodity/quantity; do not treat unrelated income as sale proceeds.
  const chineseSaleAmount = /(?:销售|出售|卖出)[^。！？\n]{0,80}多少\s*收入/u.test(question);
  if (!SALE_PROCEEDS_TOPIC.test(question) && !chineseSaleAmount) return false;
  const intent = /(?<![\p{L}])(?:(?:посчитай(?:те)?|рассчитай(?:те)?|покажи(?:те)?(?:\s+расч[её]т)?)\s+(?:(?:итоговую|чистую)\s+)?выручк[ауи]|(?:calculate|compute)\s+(?:(?:net|total|gross)\s+)?(?:revenue|proceeds))(?![\p{L}])|计算\s*(?:净收入|销售收入)/iu;
  const labelled = /^\s*(?:(?:расч[её]т\s+)?выручк[ауи]|(?:(?:net|total|gross)\s+)?(?:revenue|proceeds)|净收入|销售收入)\s*[:：]/iu.test(question);
  const bareLabelQuestion = /^\s*(?:выручк[ауи]|(?:(?:net|total|gross)\s+)?(?:revenue|proceeds)|净收入|销售收入)\s*[?？]\s*$/iu.test(question);
  const labelClause = question.match(/^\s*(?:выручк[ауи]|(?:(?:net|total|gross)\s+)?(?:revenue|proceeds))\s+(?:for|from|after|от|за|после)(?![\p{L}])\s+(.+?)\s*[?？]?\s*$/iu)?.[1] ?? '';
  const labelQuestion = bareLabelQuestion || Boolean(labelClause && (
    /\d/u.test(labelClause) && /тонн|\b(?:tonnes?|tons?)\b|吨|достав|delivery|运输费|运费/iu.test(labelClause)
    || /\b(?:amount|sum)\b|сумм|размер|多少/iu.test(labelClause)
  ));
  const amountNounQuestion = /\bwhat\s+(?:(?:is|would|will)\s+(?:the|my|our)\s+)?(?:amount|sum)\s+of\s+(?:(?:net|gross|total)\s+)?(?:revenue|proceeds)\b(?=\s*(?:$|[.!?。！？:：]|(?:from|for|of|after|would|will|could|can|does|be)\b))|(?<![\p{L}])(?:какова|какая|какую)\s+сумм[ау]\s+выручки(?=\s*(?:$|[.!?。！？:：]|(?:от|за|после|на|будет|составит)(?![\p{L}])))/iu.test(question);
  const suppliedInputs = /\d/u.test(question) && /тонн|\b(?:tonnes?|tons?)\b|吨|достав|delivery|运输费|运费/iu.test(question);
  // Numeric sale/delivery inputs require checked calculation or clarification
  // regardless of whether the question is imperative or interrogative. A
  // contextual quantity alone does not suppress conceptual model answers.
  const monetaryInputs = /руб|RUB|USD|EUR|GBP|CNY|₽|[$€£]|卢布|美元|欧元|юань|доллар|евро/iu.test(question);
  // Require a complete amount phrase or a following sale/calculation clause.
  // A shared prefix such as "what is the revenue" is insufficient when followed
  // by "definition" or "recognition principle"; those need accounting answers.
  const amountQuestion = chineseSaleAmount || labelQuestion || amountNounQuestion
    || /(?<![\p{L}])(?:сколько(?:\s+(?:будет|составит|получу))?\s+выручк[ауи]|(?:какая|какую|какова)\s+(?:будет\s+)?(?:(?:чистая|итоговая|общая|чистую|итоговую|общую)\s+)?выручк[ауи]|(?:каков|какой)\s+размер\s+выручки)(?=\s*(?:$|[.!?。！？:：]|(?:от|за|после|на|принес[\p{L}]*|получ[\p{L}]*|будет|составит)(?![\p{L}])))|\b(?:how\s+much\s+(?:(?:net|gross|total)\s+)?|what(?:(?:'s|\s+(?:is|are|was|were|would|will))\s+(?:the|my|our)\s+(?:(?:net|gross|total)\s+)?|\s+amount\s+of\s+(?:(?:net|gross|total)\s+)?|\s+(?:(?:net|gross|total)\s+)?))(?:revenue|proceeds)\b(?=\s*(?:$|[.!?。！？:：]|(?:from|for|of|after|would|will|could|can|does|be)\b))|(?:净收入|销售收入)[^。！？\n]{0,12}多少|多少\s*(?:净收入|销售收入)/iu.test(question);
  const strategyQuestion = /стратег|\bstrateg(?:y|ies)\b|策略/iu.test(question);
  const improvementQuestion = /повыс|увелич|улучш|\b(?:increase|improve|enhance|boost|grow|raise)\b|提高|改善|增加/iu.test(question);
  if (!labelled && !intent.test(question)
    && (strategyQuestion || (improvementQuestion && !amountQuestion))) return false;
  const bareRequest = new RegExp(`^\\s*(?:(?:пожалуйста|please)[,:]?\\s+|请\\s*)?(?:${intent.source})(?:\\s+(?:после\\s+доставки|after\\s+delivery))?\\s*[.!?。！？]*$`, 'iu').test(question);
  return amountQuestion || (suppliedInputs && (monetaryInputs || labelled || intent.test(question))) || bareRequest;
}
export type PaymentTimingInput = Readonly<{
  immediatePriceMinor: number;
  delayedPriceMinor: number;
  delayDays: number;
  premiumMinor: number;
  premiumBasisPoints: number;
  guarantee: 'present' | 'absent' | 'unspecified';
}>;
type UserContextTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;
const STORAGE_TOPIC = /хран[еи]|storage|stor[ei]|仓储|储存/iu;
// Bound the ambiguous price/ruble stems (оцените, трубы), while retaining
// monetary compounds such as себестоимость and перерасход.
const ECONOMIC_TOPIC = /(?<![\p{L}])(?:(?:на|у|рас)?цен|руб)|стоим|расход|прода|выгод|покры|окуп|прибыл|price|cost|sell|profit|break.even|价格|成本|出售|收益/iu;

function hasEconomicTopic(text: string): boolean {
  // Application rates are not financial expenses. Other monetary words in the
  // same request still activate the existing financial screen.
  const topic = text.replace(/(?<![\p{L}])норм(?:а|ы|у|е|ой|ою|ам|ами|ах)?\s+расхода(?![\p{L}])/giu, '');
  return ECONOMIC_TOPIC.test(topic) || topic.split(/[.!?;。！？；\n]/u).some((clause) =>
    /\binterest\s+(?:(?:annual|monthly|daily)\s+)?rates?\b|(?:年|月|日)?利率|(?:借款|贷款|融资)?利息/iu.test(clause)
    || /(?<![\p{L}])процент[\p{L}]*/iu.test(clause)
      && (/начисл|начисля|плат[её]ж|оплат|кредит|за[её]м|банковск|денежн|депозит/iu.test(clause)
        || /(?<![\p{L}])(?:процентн[\p{L}]*(?:\s+(?:годов|месячн|дневн)[\p{L}]*)?\s+ставк[\p{L}]*|ставк[\p{L}]*\s+(?:(?:в|по)\s+)?процент[\p{L}]*)/iu.test(clause)));
}
const TRANSPORT_COMPARISON = /перевоз|перевозчик|freight|haul|carrier|运输|承运/iu;
const PAYMENT_TIMING_TOPIC = /оплат|плат[её]ж|отсроч|гарант|сегодня|сразу|payment|paid|defer|guarantee|today|付款|延期|担保|今天/iu;
const PAYMENT_TONNE_PRICE = /((?:\d{1,3}(?:[ \u00A0\u202F]\d{3})+|\d{1,7})(?:[.,]\d{1,2})?)\s*(?:руб(?:лей|ля|ль)?\.?|₽|RUB)\s*(?:\/\s*т(?:онн[уы])?|за\s+тонн[уы])/giu;
const PAYMENT_DELAY_DAYS = /(?:через\s+|отсроч\w*(?:\s+на)?\s*|in\s+|after\s+|defer(?:red)?\s+(?:for\s+)?)(\d{1,3})\s*(?:дн(?:я|ей)?|days?|天)/iu;
const PAYMENT_IMMEDIATE_MARKER = /(?:с\s+оплат\w*\s+сегодня|оплат\w*\s+сегодня|сегодня|сразу|paid\s+today|payment\s+today|today|今天付款|现付)/iu;
const PAYMENT_COMPARISON_SEPARATOR = /(?:или|либо|\bvs\.?\b|\bversus\b|\bor\b|还是)/iu;

// An excluded cost/topic is not an instruction to calculate it. Keep mixed
// clauses (including hypothetical storage) eligible for the existing screen.
// A span may refer to one storage mention only. Crossing another mention
// would attach its negation to an earlier, applicable comparison.
const STORAGE_MENTION_GAP = `(?:(?!${STORAGE_TOPIC.source})[^,，.!?;。！？；\\n])`;
const STORAGE_NECESSITY_GAP = `(?:(?!${STORAGE_TOPIC.source})[^.!?;。！？；\\n])`;
const STORAGE_NECESSITY_ACTION_RU = '(?:рассчит|посчит|подсчит|отгруз|достав|сохран|пережд)[\\p{L}]*';
const STORAGE_NECESSITY_ACTION_EN = '(?:calculat(?:e|ed|ing)|comput(?:e|ed|ing)|ship(?:ped|ping)?|deliver(?:ed|ing)?|preserv(?:e|ed|ing)|wait(?:ing)?)';
const STORAGE_REQUIRED_WITHOUT = new RegExp([
  `без\\s+(?:(?:расход|стоимост|затрат)[\\p{L}]*\\s+(?:на\\s+)?)?хранени[ея]${STORAGE_NECESSITY_GAP}{0,80}(?:нельзя|невозмож|нет\\s+возможност[ьи]\\s+(?:(?:быстро|правильно|точно)\\s+)?${STORAGE_NECESSITY_ACTION_RU}|не\\s+(?:мож|могу|получ|удаст))`,
  `\\bwithout\\s+storage(?:\\s+(?:costs?|expenses?))?${STORAGE_NECESSITY_GAP}{0,80}\\b(?:cannot|can't|impossible|not\\s+possible|no\\s+(?:way|possibility)\\s+(?:(?:to|of)\\s+)?(?:(?:accurately|properly|safely)\\s+)?${STORAGE_NECESSITY_ACTION_EN})\\b`,
].join('|'), 'iu');
// A current request can refer back to storage with a pronoun rather than
// repeating it. Keep an explicit time marker, reference and cost request;
// a payment-bearing clause leaves that reference ambiguous.
const STORAGE_RENEWED_COST_REFERENCE = /\b(?:now|currently)\s+(?:(?:i|we)\s+)?(?:need|want|request)\s+(?:to\s+(?:know|calculate|compare)\s+)?(?:its|this|that)\s+(?:costs?|expenses?|price)\b|(?:теперь|сейчас)\s+(?:(?:мне|нам)\s+)?(?:нужн[аоы]|нужен|хочу\s+узнать)\s+(?:его|её|этого|такого)\s+(?:стоимост|цен|расход|затрат)[\p{L}]*|(?:现在|目前)\s*(?:我|我们)?\s*(?:需要|想知道|想了解|计算)\s*(?:它|其|这个|这种|那个)(?:的)?\s*(?:成本|费用|价格)/iu;
const REFERENCED_COST_EXCLUSION = /^\s+(?:(?:to|should|must)\s+be\s+|(?:is|are)\s+)?(?:excluded|omitted|ignored|removed|left\s+out|not\s+(?:included|counted|considered))\b|^\s+(?:(?:to|should|must)\s+not|not\s+to)\s+be\s+(?:included|counted|considered)\b|^\s+(?:исключ[\p{L}]*|убран[\p{L}]*|не\s+(?:учитыва[\p{L}]*|включ[\p{L}]*))|^\s*(?:不计入|排除|忽略)/iu;

function storageCostReferenceExcluded(clause: string): boolean {
  const reference = STORAGE_RENEWED_COST_REFERENCE.exec(clause);
  return reference !== null && STORAGE_PRIOR_ANSWER_REFERENCE.test(clause.slice(0, reference.index))
    && REFERENCED_COST_EXCLUSION.test(clause.slice(reference.index + reference[0].length));
}
const STORAGE_PRIOR_ANSWER_REFERENCE = new RegExp([
  /(?:^|[^\p{L}])(?:я|мы|ты|вы)\s+(?:(?:ранее|раньше|уже|только\s+что)\s+)?(?:говорил[аи]?|сказал[аи]?|предложил[аи]?|упоминал[аи]?|обсуждал[аи]?)/u.source,
  /(?:^|[^\p{L}])(?:предыдущ|прошл|тво|ваш)[\p{L}]*\s+(?:ответ|сообщени)/u.source,
  /\b(?:your|the|previous|earlier|last)\s+(?:(?:previous|earlier|last)\s+)?(?:answer|reply)\b/.source,
  /\b(?:you|i|we)\s+(?:(?:earlier|previously|already|just)\s+)?(?:said|mentioned|suggested|proposed|talked|discussed)\b/.source,
  /\b(?:earlier|previously|last\s+time)\s+(?:we|you|i)\s+(?:said|mentioned|suggested|talked|discussed)\b/.source,
  /(?:你|您)(?:之前|刚才|先前)?(?:的)?(?:回答|回复|说|提到|提及)|(?:之前|刚才|先前)(?:的)?(?:回答|回复)/.source,
  /(?:我|我们)(?:之前|刚才|先前)(?:的)?(?:回答|回复|说过?|提到|提及|谈过|讨论过)/.source,
].join('|'), 'iu');
const STORAGE_EXCLUDED = new RegExp([
  /не\s+(?:нужно|надо|требуется|буду|будем)\s+(?:хранить|хранени[ея])/.source,
  `(?:хранить|хранени[ея])${STORAGE_MENTION_GAP}{0,48}\\s+не\\s+(?:нужно|надо|требуется|нужн[оаы]|предусмотрено|учитыва[\\p{L}]*|включа[\\p{L}]*)`,
  /без\s+(?:расходов\s+на\s+)?хранени[ея]/.source,
  /не\s+(?:добавля|учитыва|включа)[\p{L}]*\s+(?:(?:расход|стоимост|затрат)[\p{L}]*\s+(?:на\s+)?)?хранени[ея]/u.source,
  /(?<![\p{L}])исключ(?:и|ите|ить)\s+(?:из\s+(?:расч[её]та|сметы)\s+)?(?:(?:расход|стоимост|затрат)[\p{L}]*\s+(?:на\s+)?)?хранени[ея]/u.source,
  /хранени[ея]\s+(?:(?:(?:был|была|были|было|будет|будут)\s+)?исключен[\p{L}]*|не\s+(?:должен|должна|должны|должно|будет|будут)\s+(?:учитыв|включ)[\p{L}]*)/u.source,
  `не\\s+(?:упомина|обсужда|говори)[\\p{L}]*${STORAGE_MENTION_GAP}{0,48}(?:хранить|хранени[еяи])`,
  /\bno\s+need\s+(?:to\s+stor(?:e|ing)|for\s+storage)\b/.source,
  /^\s*(?:no|without)\s+storage(?:\s+(?:costs?|expenses?))?(?=\s*(?:$|[,，:]|\bcompare\b))/.source,
  /^\s*no\s+storage\s+(?:is\s+)?(?:needed|required)\b/.source,
  /\b(?:assuming|assume)\s+no\s+storage(?:\s+(?:costs?|expenses?))?(?:\s+is\s+(?:needed|required|necessary|planned|involved))?(?:\s+for\s+(?:this|the|our)\s+(?:deal|shipment|transaction|sale|delivery|contract))?(?=\s*(?:$|[,，:]))/.source,
  /\b(?:excluding|exclude|omitting|omit|ignoring|ignore)\s+(?:the\s+)?storage(?:\s+(?:costs?|expenses?))?\b/.source,
  /\bstorage(?:\s+(?:costs?|expenses?))?\s+(?:(?:is|are|was|were|will\s+be|(?:has|have|had|should\s+have|must\s+have)\s+been)\s+(?:excluded|omitted|ignored|not\s+(?:included|counted|considered))|(?:(?:should|must)\s+not|not\s+to)\s+be\s+(?:included|counted|considered)|(?:should|must|to)\s+be\s+(?:excluded|omitted|ignored))\b/.source,
  `\\b(?:storage|stor(?:e|ing))\\b${STORAGE_MENTION_GAP}{0,48}\\b(?:not\\s+(?:needed|required)|isn't\\s+(?:needed|required))\\b`,
  /\b(?:do\s+not|don't)\s+(?:include|need|require)\s+(?:the\s+)?storage\b/.source,
  /\b(?:do\s+not|don't)\s+need\s+to\s+store\b/.source,
  `\\b(?:do\\s+not|don't)\\s+(?:mention|discuss|talk\\s+about)${STORAGE_MENTION_GAP}{0,48}\\bstorage\\b`,
  `(?:无需|不需要|不用|不必)${STORAGE_MENTION_GAP}{0,20}(?:仓储|储存)`,
  `(?:仓储|储存)${STORAGE_MENTION_GAP}{0,20}(?:不需要|无需)`,
  `(?:不要|不应)\\s*(?:计入|加入|考虑)${STORAGE_MENTION_GAP}{0,20}(?:仓储|储存)`,
  `(?:不要|别)\\s*(?:再)?\\s*(?:提及|提到|提|讨论|谈论)${STORAGE_MENTION_GAP}{0,20}(?:仓储|储存)`,
].join('|'), 'iu');

function storageClauses(text: string): string[] {
  return text
    .split(/[.!?;。！？；\n]|(?:,?\s+(?:но|однако)\s+)|(?:,?\s+\b(?:but|however)\b\s+)|(?:，?\s*(?:但是|但)\s*)/iu)
    .filter((clause) => STORAGE_TOPIC.test(clause));
}

function storageExplicitlyExcluded(text: string): boolean {
  const clauses = storageClauses(text).flatMap((clause) =>
    STORAGE_PRIOR_ANSWER_REFERENCE.test(clause) && !STORAGE_RENEWED_COST_REFERENCE.test(clause)
      ? clause.split(/\s+and\s+|\s+и\s+|而/iu).filter((part) => STORAGE_TOPIC.test(part))
      : [clause]).filter((clause) =>
    !STORAGE_PRIOR_ANSWER_REFERENCE.test(clause)
    || STORAGE_RENEWED_COST_REFERENCE.test(clause)
    || STORAGE_REQUIRED_WITHOUT.test(clause));
  return clauses.length > 0 && clauses.every((clause) => {
    // Double negation and unexcluded mentions keep the conservative screen.
    if (STORAGE_REQUIRED_WITHOUT.test(clause)
      || /не\s+исключ(?:и|ите|ить)\s+(?:из\s+(?:расч[её]та|сметы)\s+)?(?:(?:расход|стоимост|затрат)[\p{L}]*\s+(?:на\s+)?)?хранени[ея]/iu.test(clause)
      || /не\s+(?:нужно|надо|требуется)\s+(?:исключ|игнор|убир)|\bnot\s+(?:needed|required)\s+to\s+(?:exclude|ignore)|\b(?:do\s+not|don't|must\s+not|cannot|can't|without|never)\s+(?:excluding|exclude|omitting|omit|ignoring|ignore)\s+(?:the\s+)?storage\b|无需\s*(?:忽略|排除)/iu.test(clause)) return false;
    if (storageCostReferenceExcluded(clause) && [...clause.matchAll(new RegExp(STORAGE_TOPIC.source, 'giu'))].length === 1) return true;
    const exclusions = [...clause.matchAll(new RegExp(STORAGE_EXCLUDED.source, 'giu'))];
    return [...clause.matchAll(new RegExp(STORAGE_TOPIC.source, 'giu'))].every((topic) =>
      exclusions.some((exclusion) => topic.index >= exclusion.index
        && topic.index + topic[0].length <= exclusion.index + exclusion[0].length));
  });
}

function storageAffirmativelyRequested(text: string): boolean {
  const clauses = storageClauses(text);
  if (clauses.some((clause) => STORAGE_REQUIRED_WITHOUT.test(clause))) return true;
  if (clauses.some((clause) => STORAGE_PRIOR_ANSWER_REFERENCE.test(clause)
    && !storageExplicitlyExcluded(clause)
    && !PAYMENT_TIMING_TOPIC.test(clause)
    && STORAGE_RENEWED_COST_REFERENCE.test(clause))) return true;
  return clauses.flatMap((clause) => clause.split(/[,，]|\s+and\s+|\s+и\s+|而/iu)).some((clause) => {
    if (!STORAGE_TOPIC.test(clause)) return false;
    if (storageExplicitlyExcluded(clause)) return false;
    // Mentioning a previous answer is not renewed physical-storage intent.
    if (STORAGE_PRIOR_ANSWER_REFERENCE.test(clause)) return false;
    return hasEconomicTopic(clause)
      || /хранить|нуж|необходим|если|нельзя|невозмож|\bstor(?:e|es|ed|ing)\b|\b(?:if|need|needed|required)\b|cannot\s+(?:ship|avoid)|储存|需要|必须|如果/iu.test(clause)
      || (/месяц|срок|month|duration|月|期限/iu.test(clause) && !PAYMENT_TIMING_TOPIC.test(clause));
  });
}

/** History establishes a topic only; assistant prose never establishes a quantity. */
export function economicComparisonFor(question: string, history: readonly UserContextTurn[]): EconomicComparison | null {
  if (saleProceedsFromUser(question) !== null || saleCalculationRequested(question)) return 'sale_proceeds';
  if (/документ|персональн|хранени[ея]\s+данных|платформ|document|personal data|data retention|platform|文件|个人数据|平台/iu.test(question)) return null;
  if (paymentTimingFromUser(question) !== null) return 'payment_timing';
  if (TRANSPORT_COMPARISON.test(question) && /рейс|тонн|тариф|trip|tonne|rate|趟|吨|费率/iu.test(question)) return 'transport';
  const lastUser = [...history].reverse().find((turn) => turn.role === 'user')?.text ?? '';
  const economicFollowUp = STORAGE_TOPIC.test(lastUser) && hasEconomicTopic(lastUser)
    && /месяц|покры|срок|month|cover|duration|月|期限/iu.test(question);
  const paymentChoice = /оплат|плат[её]ж|денежн|банк[\p{L}]*\s+гарант|payment|paid|bank\s+guarantee|付款|银行担保/iu.test(question)
    && /сравн|выбр|выбор|выбира|что\s+выбрать|что\s+лучше|какой\s+вариант|compar|choos|select|which|better|比较|选择|哪|更/iu.test(question);
  // Excluding storage arithmetic must not disable the existing monetary
  // output screen or qualitative-only provider instruction for a cost question.
  if (storageExplicitlyExcluded(question)) return hasEconomicTopic(question) || economicFollowUp || paymentChoice ? 'qualitative' : null;
  if ((STORAGE_TOPIC.test(question) && hasEconomicTopic(question)) || economicFollowUp) {
    return storageExplicitlyExcluded(lastUser) && !storageAffirmativelyRequested(question) ? 'qualitative' : 'storage';
  }
  return paymentChoice ? 'qualitative' : null;
}

function moneyMinor(raw: string): number | null {
  const normalized = raw.replace(/[ \u00A0\u202F]/gu, '').replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const [rubles, kopecks = ''] = normalized.split('.');
  const minor = Number(rubles) * 100 + Number(kopecks.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/**
 * A deliberately narrow same-turn payment-timing calculation.
 * We only accept exactly two explicit RUB/tonne prices, an explicit "today"
 * marker for the first price and an explicit day delay for the second. This
 * avoids inheriting stale numbers or guessing which commercial option is which.
 */
export function paymentTimingFromUser(question: string): PaymentTimingInput | null {
  if (!PAYMENT_TIMING_TOPIC.test(question) || !PAYMENT_COMPARISON_SEPARATOR.test(question)) return null;
  const prices = [...question.matchAll(PAYMENT_TONNE_PRICE)];
  if (prices.length !== 2 || prices[0].index === undefined || prices[1].index === undefined) return null;

  const firstRaw = prices[0][1];
  const secondRaw = prices[1][1];
  const immediatePriceMinor = moneyMinor(firstRaw);
  const delayedPriceMinor = moneyMinor(secondRaw);
  if (immediatePriceMinor === null || delayedPriceMinor === null) return null;

  const firstEnd = prices[0].index + prices[0][0].length;
  const secondStart = prices[1].index;
  const secondEnd = secondStart + prices[1][0].length;
  const between = question.slice(firstEnd, secondStart);
  const after = question.slice(secondEnd);
  if (!PAYMENT_IMMEDIATE_MARKER.test(between) || !PAYMENT_COMPARISON_SEPARATOR.test(between)) return null;

  const delayMatch = PAYMENT_DELAY_DAYS.exec(after);
  if (!delayMatch) return null;
  const delayDays = Number(delayMatch[1]);
  if (!Number.isSafeInteger(delayDays) || delayDays < 1 || delayDays > 365) return null;

  const premiumMinor = delayedPriceMinor - immediatePriceMinor;
  const premiumBasisPoints = Math.round((premiumMinor * 10_000) / immediatePriceMinor);
  if (!Number.isSafeInteger(premiumBasisPoints)) return null;

  const guarantee = /без\s+(?:банковск[\p{L}-]*\s+)?гарант/iu.test(question)
    ? 'absent'
    : /(?:с|есть)\s+(?:банковск[\p{L}-]*\s+)?гарант/iu.test(question)
      ? 'present'
      : 'unspecified';

  return Object.freeze({
    immediatePriceMinor,
    delayedPriceMinor,
    delayDays,
    premiumMinor,
    premiumBasisPoints,
    guarantee,
  });
}

/** Bounded output screen, not a proof of arbitrary financial prose. */
export function economicBlockAllowed(block: string): boolean {
  const body = block.replace(/^\d+[.)]\s*/u, '');
  return !/[\d=\\]|руб|ruble|\bRUB\b|卢布|месяц|month|个月|%|процент|(?<![\p{L}])ставк[аи](?![\p{L}])|годов|interest|annual|利率|(?:продавать|продать|покупать|купить|хранить)\s+(?:сейчас|сегодня|немедленно)|(?:сейчас|сегодня|немедленно)\s+(?:продавать|продать|покупать|купить|хранить)|выгод|лучше|дешевле|дороже|окуп|прибыль|рентабель|предпочт|разумнее|безопаснее|надежнее|оптимальн|перв\w*\s+вариант|втор\w*\s+вариант|(?:продавать|продать|хранить|купить|покупать)\s+(?:сейчас|сегодня|немедленно)|(?:сейчас|сегодня|немедленно)\s+(?:продавать|продать|хранить|купить|покупать)|продавай|продайте|храните|выбира|выбери|рекоменд|советую|следует\s+(?:прода|хран)|profita|cheaper|more expensive|better|safer|prefer|optimal|first\s+option|second\s+option|choose|select|recommend|should\s+(?:sell|stor)|\bsell now\b|pay[s]? off|更划算|更便宜|盈利|获利|更有利|更好|第一个方案|第二个方案|应选|选择|建议|应该|现在卖/iu.test(body)
    && !/(?:два|двух|три|тр[её]х|несколько|two|three|several|[一二三四五六七八九十两])\s*(?:месяц|month|个月|月)/iu.test(body);
}

type StorageInput = Readonly<{ value: number; unit: 'RUB_PER_TONNE_MONTH_MINOR' | 'MONTH'; userTurn: number }>;

/** Only a deliberately narrow, explicit RUB/tonne/month × integer-month calculation. */
export function storageCostFromUser(question: string, history: readonly UserContextTurn[]): number | null {
  if (economicComparisonFor(question, history) !== 'storage') return null;
  let rate: StorageInput | null = null;
  let duration: StorageInput | null = null;
  // Only a bounded duration-only continuation may inherit the preceding rate.
  // A newly named commodity, free-form correction or longer thread requires
  // explicit restatement; do not try to infer commodity identity from a list.
  const previous = [...history].reverse().find((turn) => turn.role === 'user')?.text;
  const continuation = /^срок\s+хранения\s+(?:\d{1,3}|один|два|двух|три|тр[её]х)\s+месяц(?:а|ев)?[.?!]?\s*(?:насколько\s+должна\s+вырасти\s+цена,?\s+чтобы\s+покрыть\s+только\s+хранение[?.]?)?$/iu.test(question.trim());
  const turns = [...(previous && continuation ? [previous] : []), question];
  for (const [userTurn, text] of turns.entries()) {
    const ambiguousNumber = /\d\s+\d|[-−]\s*\d|\d\s*[–—-]\s*\d|от\s+\d.{0,12}до\s+\d|\d[eE][+-]?\d/iu.test(text);
    // Ambiguous corrections or a unit change invalidate the old input, never reuse it silently.
    if (/(?:\d.{0,20}(?:руб|₽|RUB)|тариф|хран[еи].{0,35}(?:\d|стоим|цен|руб)|(?:storage|仓储).{0,35}(?:\d|cost|rate|成本))/iu.test(text)) {
      const matches = [...text.matchAll(/(?:^|[\s.!?;])(?:хранение|стоимость\s+хранения)(?:\s+стоит)?\s+(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:руб(?:лей|ля|ль)?\.?|₽|RUB)\s*(?:за\s*тонн[уы]|\/\s*т(?:онн[уы])?)\s*(?:в\s*месяц|\/\s*мес(?:яц)?)/giu)];
      rate = null;
      if (!ambiguousNumber && matches.length === 1 && !/(?:(?:^|\s)не\s+(?:\d|один|два|три|хранени|стоимост|срок)|неизвест|отмен|not\s|unknown|(?:\d|один|два|три)\s*(?:или|либо))/iu.test(text)) {
        const parts = matches[0][1].replace(',', '.').split('.');
        const value = Number(parts[0]) * 100 + Number((parts[1] ?? '').padEnd(2, '0'));
        if (Number.isSafeInteger(value) && value > 0) rate = { value, unit: 'RUB_PER_TONNE_MONTH_MINOR', userTurn };
      }
    }
    const durationText = text.replace(/(?:в\s*месяц|\/\s*мес(?:яц)?)/giu, '');
    if (/месяц|год|лет|недел|дн|duration|store for|period|срок\s+(?:неизвест|отмен|измен|друг)/iu.test(durationText)) {
      const matches = [...text.matchAll(/(?:срок\s+хранения|хранить|хранение\s+на)\s+(\d{1,3}|один|два|двух|три|тр[её]х)\s+месяц(?:а|ев)?/giu)];
      duration = null;
      if (!ambiguousNumber && matches.length === 1 && !/(?:(?:^|\s)не\s+(?:\d|один|два|три|хранени|стоимост|срок)|неизвест|отмен|not\s|unknown|(?:\d|один|два|три)\s*(?:или|либо))/iu.test(text)) {
        const words: Record<string, number> = { один: 1, два: 2, двух: 2, три: 3, трех: 3, трёх: 3 };
        const value = words[matches[0][1].toLowerCase()] ?? Number(matches[0][1]);
        if (Number.isSafeInteger(value) && value > 0 && value <= 120) duration = { value, unit: 'MONTH', userTurn };
      }
    }
  }
  if (!rate || !duration) return null;
  const minor = rate.value * duration.value;
  return Number.isSafeInteger(minor) ? minor : null;
}

export function economicComparisonCopy(kind: EconomicComparison, locale: PublicLocale, storageMinor: number | null, payment: PaymentTimingInput | null = null, sale: SaleProceedsInput | null = null): string {
  if (kind === 'sale_proceeds') {
    if (sale === null) {
      if (locale === 'en') return 'Proceeds after delivery = quantity × sale price − total delivery charge. Specify the quantity in metric tonnes, the RUB-per-tonne sale price and the total delivery charge unambiguously in the same question for the same crop.';
      if (locale === 'zh') return '扣除运输费后的收入 = 吨数 × 销售单价 − 运输总费用。请在同一个问题中明确同一种作物的公吨数、每吨卢布销售价格和运输总费用。';
      return 'Остаток после доставки = объём × цена продажи − общая стоимость доставки. Укажите в одном вопросе однозначный объём в метрических тоннах, цену продажи в рублях за тонну и общую стоимость доставки одной культуры.';
    }
    const decimal = (value: number, scale: number): string => {
      const negative = value < 0 ? '-' : '';
      const digits = BigInt(Math.abs(value)).toString().padStart(scale + 1, '0');
      const fraction = digits.slice(-scale).replace(/0+$/u, '');
      return negative + digits.slice(0, -scale) + (fraction ? '.' + fraction : '');
    };
    const quantity = decimal(sale.quantityMilliTonnes, 3);
    const price = decimal(sale.priceMinorPerTonne, 2);
    const gross = decimal(sale.grossMinor, 2);
    const delivery = decimal(sale.deliveryMinor, 2);
    const net = decimal(sale.proceedsMinor, 2);
    if (locale === 'en') return `Calculation from your inputs: ${quantity} t × ${price} RUB/t = ${gross} RUB gross revenue. After the stated delivery charge: ${gross} − ${delivery} = ${net} RUB. This is proceeds after delivery only, not profit; other costs and taxes are not included. No current market price was verified.`;
    if (locale === 'zh') return `根据你提供的数据：${quantity}吨 × ${price}卢布/吨 = ${gross}卢布销售收入。扣除所述运输费用：${gross} − ${delivery} = ${net}卢布。这仅是扣除运输费后的收入，不是利润；未计入其他成本和税款，也未核实当前市场价格。`;
    return `Расчёт по вашим данным: ${quantity} т × ${price} руб/т = ${gross} руб выручки. После указанной доставки: ${gross} − ${delivery} = ${net} руб. Это остаток после доставки, а не прибыль: другие расходы и налоги не учтены. Текущая рыночная цена не проверялась.`;
  }
  if (kind === 'qualitative') {
    if (locale === 'en') return 'To assess profitability, compare confirmed costs and payment terms. A price comparison alone does not determine which option to choose.';
    if (locale === 'zh') return '评估收益时，应比较已核实的费用和付款条件；仅比较价格不能决定应选哪一种方案。';
    return 'Для оценки выгодности сравните подтверждённые расходы и условия оплаты. Сравнение цен само по себе не определяет, какой вариант выбрать.';
  }
  if (kind === 'transport') {
    if (locale === 'en') return 'Compare the total quote per trip divided by the actual payable tonnes with the per-tonne quote. Include all trips, loading, waiting and return charges. What are both rates and the actual load?';
    if (locale === 'zh') return '将按趟报价的总费用除以实际计费吨数，再与按吨报价比较；计入全部趟数、装卸、等待和返程费用。两种费率和实际装载量是多少？';
    return 'Разделите полную стоимость всех рейсов на фактически оплачиваемый тоннаж и сравните с тарифом за тонну. Учтите погрузку, простой и обратный путь. Какие тарифы и фактическая загрузка?';
  }
  if (kind === 'payment_timing') {
    if (payment === null) {
      if (locale === 'en') return 'For a payment-timing comparison, specify two RUB-per-tonne prices, which one is paid today, and the exact delay in days. Without those explicit inputs, no option should be selected.';
      if (locale === 'zh') return '比较付款时点时，请明确两种每吨卢布价格、哪一种今天付款，以及延期的确切天数。缺少这些明确输入时，不应替你选择方案。';
      return 'Для сравнения условий оплаты укажите две цены в руб/т, какой вариант оплачивается сегодня и точный срок отсрочки в днях. Без этих явных данных выбирать вариант нельзя.';
    }
    const premium = Math.abs(payment.premiumMinor) / 100;
    const premiumText = premium.toFixed(2).replace(/\.00$/u, '').replace('.', ',');
    const percent = Math.abs(payment.premiumBasisPoints) / 100;
    const percentText = percent.toFixed(2).replace(/\.00$/u, '').replace('.', ',');
    const directionEn = payment.premiumMinor >= 0 ? 'adds' : 'reduces the price by';
    const directionZh = payment.premiumMinor >= 0 ? '增加' : '减少';
    const guaranteeRu = payment.guarantee === 'absent'
      ? 'В запросе банковской гарантии нет, поэтому риск неплатежа нужно оценивать отдельно.'
      : payment.guarantee === 'present'
        ? 'В запросе указана банковская гарантия; отдельно проверьте её условия и исполнимость.'
        : 'Статус банковской гарантии не указан; его нужно проверить отдельно.';
    const guaranteeEn = payment.guarantee === 'absent'
      ? 'No bank guarantee is stated, so counterparty non-payment risk must be assessed separately.'
      : payment.guarantee === 'present'
        ? 'A bank guarantee is stated; verify its terms and enforceability separately.'
        : 'Bank-guarantee status is not stated and must be checked separately.';
    const guaranteeZh = payment.guarantee === 'absent'
      ? '请求中未说明银行担保，因此需要单独评估交易对手不付款风险。'
      : payment.guarantee === 'present'
        ? '请求中说明有银行担保；仍需单独核对其条款和可执行性。'
        : '未说明银行担保状态，需要单独核对。';
    if (locale === 'en') return `Calculation from your inputs: a ${payment.delayDays}-day delay ${directionEn} ${premiumText.replace(',', '.')} RUB/t, or ${percentText.replace(',', '.')}% relative to the price paid today. ${guaranteeEn} This does not determine which option to choose: compare the cost of money over ${payment.delayDays} days, counterparty risk and recovery terms.`;
    if (locale === 'zh') return `根据你提供的数据：延期${payment.delayDays}天使每吨价格${directionZh}${premiumText}卢布，相当于相对今天付款价格的${percentText}%。${guaranteeZh}这并不能决定应选哪一种方案；还需比较这${payment.delayDays}天的资金成本、交易对手风险和追偿条件。`;
    const premiumRu = payment.premiumMinor >= 0 ? `добавляет ${premiumText} руб/т к цене` : `уменьшает цену на ${premiumText} руб/т`;
    return `Расчёт по вашим данным: отсрочка на ${payment.delayDays} дней ${premiumRu}, то есть ${percentText}% относительно цены с оплатой сегодня. ${guaranteeRu} Это не определяет, какой вариант выбрать: сравните стоимость денег за ${payment.delayDays} дней, риск контрагента и условия взыскания.`;
  }
  const amount = storageMinor === null ? null : (storageMinor / 100).toFixed(2).replace(/\.00$/u, '');
  if (locale === 'en') return `${amount === null ? 'Storage-only break-even is the monthly cost per tonne multiplied by the holding period; please specify both inputs with units.' : `Calculation from your inputs: covering storage alone requires a price increase of ${amount} RUB per tonne.`} This does not establish total profitability: compare future net proceeds, quality losses, financing and delivery costs.`;
  if (locale === 'zh') return `${amount === null ? '仅覆盖仓储费所需的涨价等于每吨每月费用乘以储存月数；请提供带单位的费用和期限。' : `根据你提供的数据计算：仅覆盖仓储费，每吨价格需上涨${amount}卢布。`}这不代表总体盈利；还需比较未来净收入、质量损失、融资和运输费用。`;
  return `${amount === null ? 'Для покрытия только хранения умножьте месячную стоимость за тонну на срок. Уточните эти два значения с единицами.' : `Расчёт по вашим данным: для покрытия только хранения цена должна вырасти на ${amount.replace('.', ',')} руб/т.`} Это не доказывает общую выгодность: сравните будущую чистую выручку, потери качества, финансирование и доставку.`;
}

export class StreamingAnswerGate {
  private pending = '';
  private published = '';
  private violationState: GateViolation | null = null;
  private partialBlockOpen = false;
  private progressiveSafetyContext = '';
  private discardedSaleRawContext = '';
  private discardedSaleFormattingContext = '';
  private discardedSaleRenderedContext = '';
  private discardedSaleRenderedFormattingContext = '';
  private discardedSaleDecodedContext = '';
  private discardedSaleDecodedFormattingContext = '';
  private discardedSaleReferenceTail = '';
  private discardedSaleTagState = newSaleTagScanState();
  private discardedSaleDecodedTagState = newSaleTagScanState();
  private progressiveJoiner = ' ';
  private pendingListMarker = '';
  private readonly authority: string;
  private readonly maxPendingChars: number;

  constructor(private readonly options: StreamingAnswerGateOptions) {
    this.authority = groundingAuthority(options.grounding);
    this.maxPendingChars = options.maxPendingChars ?? DEFAULT_MAX_PENDING_CHARS;
  }

  /** Everything the gate has published so far, as the reader has it. */
  get emitted(): string {
    return this.published;
  }

  get violation(): GateViolation | null {
    return this.violationState;
  }

  /** Text still withheld. Non-empty mid-answer is normal, not an error. */
  get withheld(): string {
    return this.pending;
  }

  push(delta: string): GateCommit {
    if (this.violationState !== null || !delta) return EMPTY_COMMIT;
    if (this.options.economicComparison === 'sale_proceeds') {
      const flags = new Set<string>();
      // Bound each safety scan even if one transport delta contains a whole
      // long answer. No provider sale prose is ever published.
      for (let index = 0; index < delta.length; index += 512) {
        this.pending += delta.slice(index, index + 512);
        const commit = this.drain(false);
        if (commit.violation) return commit;
        for (const flag of commit.flags) flags.add(flag);
      }
      return { text: '', flags: Object.freeze([...flags]), violation: null };
    }
    this.pending += delta;
    return this.drain(false);
  }

  /** Release whatever remains once generation has ended. */
  flush(): GateCommit {
    if (this.violationState !== null) return EMPTY_COMMIT;
    const commit = this.drain(true);
    // A standalone number may be a valid answer outside evidence-bound output.
    // An orphan marker after actual content is never published on its own.
    if (!commit.violation && !this.published && this.pendingListMarker && !this.options.currentDataRequired && !this.options.economicComparison) {
      this.published = this.pendingListMarker;
      this.pendingListMarker = '';
      return { ...commit, text: this.published };
    }
    this.pendingListMarker = '';
    return commit;
  }

  private discardedSaleDecodedText(head: string, final: boolean): { original: string; joined: string } {
    const encoded = this.discardedSaleReferenceTail + head;
    const unfinished = !final
      ? encoded.match(/&(?:#(?:[xX][0-9a-fA-F]*|[0-9]*)|[A-Za-z][A-Za-z0-9]{0,31})?$/u)?.[0] ?? ''
      : '';
    this.discardedSaleReferenceTail = unfinished ? decodeSaleCharacterReferences(unfinished, false) : '';
    const original = decodeSaleCharacterReferences(encoded.slice(0, encoded.length - unfinished.length), true);
    // Decode each original character reference once, then scan its tag boundaries.
    // Retained decoded context is never passed back through the entity decoder.
    return { original, joined: saleTextWithoutTagBoundaries(original, this.discardedSaleDecodedTagState, false) };
  }

  private discardSaleProse(final: boolean): GateCommit {
    const head = this.pending;
    this.pending = '';
    if (!head && (!final || !(this.discardedSaleRenderedContext || this.discardedSaleDecodedContext || this.discardedSaleReferenceTail))) return EMPTY_COMMIT;
    // Nothing from this mode is published, so even unclosed traces, fences and
    // envelopes can be scanned and discarded immediately. Check original raw
    // contents before any formatting removal; trace text is not a safety bypass.
    const rawBlock = `${this.discardedSaleRawContext}${head}`.replace(/\s+/gu, ' ');
    // Also normalize formatting within original tag contents, including an
    // unclosed tag. The tag-stripped view alone cannot inspect that remainder.
    const formattingBlock = `${this.discardedSaleFormattingContext}${head}`
      .replace(/[*_`]/gu, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
      .replace(/\s+/gu, ' ');
    const normalizedHead = saleTextWithoutTagBoundaries(head, this.discardedSaleTagState, true);
    const decoded = this.discardedSaleDecodedText(head, final);
    // Keep a second bounded view without formatting, including tags split over
    // arbitrarily long transport cuts. A separate raw view preserves real keys
    // containing underscores; normalization cannot silently erase such tokens.
    const block = sanitizeAnswer(`${this.progressiveSafetyContext}${this.progressiveJoiner}${normalizedHead}`.replace(/[*_`]/gu, ''));
    // Inline tags can split a rendered token: trans<em>ferred</em> or a secret.
    // Keep actual whitespace but join tag boundaries in this additional view.
    // Do not trim each fragment: trailing spaces remain significant across cuts.
    const decodedRawBlock = `${this.discardedSaleDecodedContext}${decoded.original}`
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
      .replace(/\s+/gu, ' ');
    const decodedFormattingBlock = `${this.discardedSaleDecodedFormattingContext}${decoded.original}`
      .replace(/[*_`]/gu, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
      .replace(/\s+/gu, ' ');
    const renderedRawBlock = `${this.discardedSaleRenderedContext}${decoded.joined}`
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
      .replace(/\s+/gu, ' ');
    const renderedBlock = `${this.discardedSaleRenderedFormattingContext}${decoded.joined}`
      .replace(/[*_`]/gu, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
      .replace(/\s+/gu, ' ');
    const views = [rawBlock, formattingBlock, block, decodedRawBlock, decodedFormattingBlock, renderedRawBlock, renderedBlock];
    if (views.some((view) => WRITE_CLAIM_PATTERN.test(view))) return this.refuse('WRITE_CLAIM');
    if (views.some((view) => SECRET_PATTERN.test(view))) return this.refuse('SECRET');
    const flags = ['UNVERIFIED_ECONOMIC_CLAIM_REMOVED'];
    if (views.some(isUngroundedCropProtectionPrescription)) flags.push('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    this.discardedSaleRenderedContext = renderedRawBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.discardedSaleRenderedFormattingContext = renderedBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.discardedSaleDecodedContext = decodedRawBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.discardedSaleDecodedFormattingContext = decodedFormattingBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.discardedSaleFormattingContext = formattingBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.discardedSaleRawContext = rawBlock.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    this.progressiveSafetyContext = block.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
    if (normalizedHead) this.progressiveJoiner = /\s$/u.test(normalizedHead) ? ' ' : '';
    return { text: '', flags: Object.freeze(flags), violation: null };
  }

  private drain(final: boolean): GateCommit {
    if (this.options.economicComparison === 'sale_proceeds') return this.discardSaleProse(final);
    const decidable = final ? this.pending.length : undecidedTailStart(this.pending);
    const overflowing = !final && this.pending.length > this.maxPendingChars;
    const progressiveAllowed = !final
      && this.options.answerMode === 'general_agro'
      && !this.options.currentDataRequired
      && !this.options.economicComparison;

    let head = this.pending.slice(0, decidable);
    if (!head) return EMPTY_COMMIT;

    let consumed = head.length;
    let progressiveFragment = false;
    if (!final && !BLOCK_BOUNDARY.test(head)) {
      const lastBoundary = lastBlockBoundary(head);
      if (lastBoundary > 0) {
        head = head.slice(0, lastBoundary);
        consumed = lastBoundary;
      } else if (progressiveAllowed) {
        const wordBoundary = progressiveWordBoundary(head, this.options.locale);
        if (wordBoundary <= 0) return EMPTY_COMMIT;
        head = head.slice(0, wordBoundary);
        consumed = wordBoundary;
        progressiveFragment = true;
      } else if (overflowing) {
        // Never publish an undecided economic claim merely to bound the buffer.
        if (this.options.economicComparison) return this.refuse('OUTPUT_LIMIT');
        const wordBreak = head.lastIndexOf(' ');
        if (wordBreak <= 0) return EMPTY_COMMIT;
        head = head.slice(0, wordBreak);
        consumed = wordBreak;
      } else {
        return EMPTY_COMMIT;
      }
    }

    if (progressiveFragment) {
      const candidate = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${head}`
        : head;
      if (CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN.test(candidate)
        || CROP_PROTECTION_NAMED_PRODUCT_PRELUDE_PATTERN.test(candidate)
        || (this.options.locale === 'zh' && CHINESE_PRESCRIPTION_PREFIX.test(candidate))) return EMPTY_COMMIT;
    }

    this.pending = this.pending.slice(consumed);

    // Sanitization trims a new fragment's leading whitespace. Preserve that
    // boundary, including a delta containing only whitespace, until text is
    // committed. Keep the safety lookbehind across the same boundary.
    if (this.partialBlockOpen && /^\s/u.test(head)) {
      this.progressiveJoiner = /^\s*\n/u.test(head) || this.progressiveJoiner === '\n'
        ? '\n'
        : ' ';
    }

    const flags: string[] = [];
    const kept: string[] = [];
    const blocks = splitAnswerBlocks(stripInternalModelTrace(head)).flatMap((block) => block.split(/(?<=[。！？])/u));
    for (const rawBlock of blocks) {
      let block = sanitizeAnswer(rawBlock);
      if (!block) continue;

      // A numbered prefix is punctuation, not a complete answer sentence.
      // Keep it with the following body so filtering cannot leave an empty item.
      if (/^\d{1,2}[.)]$/u.test(block)) {
        this.pendingListMarker = block;
        continue;
      }
      if (this.pendingListMarker) {
        block = `${this.pendingListMarker} ${block}`;
        this.pendingListMarker = '';
      }

      // A progressive fragment can split one sentence over several commits.
      // Re-check the bounded tail already published with the new fragment so a
      // prohibited claim cannot be assembled across the transport boundary.
      const safetyBlock = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${block}`
        : block;

      // A block claiming an executed write, or carrying secret-shaped material,
      // invalidates the whole answer. Text already published is not "kept anyway":
      // the caller seals the stream with a refusal, and the contract's outcome
      // rule makes a refused stream unusable end to end.
      if (WRITE_CLAIM_PATTERN.test(safetyBlock)) return this.refuse('WRITE_CLAIM');
      if (SECRET_PATTERN.test(safetyBlock)) return this.refuse('SECRET');
      if (isUngroundedCropProtectionPrescription(safetyBlock)) {
        flags.push('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
        continue;
      }

      if (this.options.economicComparison && !economicBlockAllowed(block)) {
        flags.push('UNVERIFIED_ECONOMIC_CLAIM_REMOVED');
        continue;
      }

      if (this.options.answerMode === 'verified_platform') {
        const verdict = platformGroundingVerdict(block, this.authority);
        if (!verdict.keep) {
          flags.push(...verdict.flags);
          continue;
        }
      }
      if (this.options.currentDataRequired && !currentEvidenceVerdict(block)) continue;

      const linkFree = stripRawLinks(block);
      if (linkFree.removed) flags.push('RAW_LINK_REMOVED');
      if (linkFree.text) kept.push(linkFree.text);
    }

    if (kept.length === 0) return { text: '', flags: Object.freeze([...new Set(flags)]), violation: null };

    const joined = kept.join('\n');
    const separator = this.published ? (this.partialBlockOpen ? this.progressiveJoiner : '\n') : '';
    const text = `${separator}${joined}`;
    this.published += text;

    if (progressiveFragment) {
      const sentenceContext = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${joined}`
        : joined;
      this.progressiveSafetyContext = sentenceContext.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
      this.partialBlockOpen = true;
      this.progressiveJoiner = /\s$/u.test(head) ? ' ' : '';
    } else {
      this.progressiveSafetyContext = '';
      this.partialBlockOpen = false;
    }

    return { text, flags: Object.freeze([...new Set(flags)]), violation: null };
  }

  private refuse(violation: GateViolation): GateCommit {
    this.violationState = violation;
    this.pending = '';
    this.discardedSaleRawContext = '';
    this.discardedSaleFormattingContext = '';
    this.discardedSaleRenderedContext = '';
    this.discardedSaleRenderedFormattingContext = '';
    this.discardedSaleDecodedContext = '';
    this.discardedSaleDecodedFormattingContext = '';
    this.discardedSaleReferenceTail = '';
    this.discardedSaleTagState = newSaleTagScanState();
    this.discardedSaleDecodedTagState = newSaleTagScanState();
    this.progressiveSafetyContext = '';
    this.partialBlockOpen = false;
    return { text: '', flags: Object.freeze([]), violation };
  }
}

/** End index of the last complete block in `value`, or 0 when there is none. */
function lastBlockBoundary(value: string): number {
  let best = 0;
  const boundary = /(?:[.!?]\s|[。！？]\s*|\n)/gu;
  for (let match = boundary.exec(value); match !== null; match = boundary.exec(value)) {
    best = match.index + match[0].length;
  }
  return best;
}

/**
 * Release whitespace-bounded text, or a complete Han character in Chinese.
 * ASCII secrets and URLs remain withheld until their whole token is decidable.
 */
function progressiveWordBoundary(value: string, locale: PublicLocale): number {
  if (value.length < GENERAL_AGRO_PROGRESSIVE_MIN_CHARS) return 0;
  const unfinishedUrl = /(?:https?:\/\/|www\.)\S*$/iu.exec(value);
  const upperBound = unfinishedUrl?.index ?? value.length;
  for (let index = upperBound - 1; index >= GENERAL_AGRO_PROGRESSIVE_MIN_CHARS - 1; index -= 1) {
    if (/\s/u.test(value[index]) || (locale === 'zh' && HAN_CHARACTER.test(value[index]))) {
      return index + 1;
    }
  }
  return 0;
}

/**
 * Incremental reader for an OpenAI-compatible `stream: true` body.
 *
 * Written as a fold over arbitrary byte chunks rather than over lines, because
 * an HTTP chunk boundary lands wherever the network puts it — routinely inside a
 * JSON payload and, with Cyrillic or Chinese output, inside a UTF-8 sequence.
 * The decoder is kept in streaming mode for the same reason.
 */
export class ProviderStreamParser {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8');
  private doneState = false;
  private stringContentReceived = false;

  get receivedStringContent(): boolean {
    return this.stringContentReceived;
  }

  get finished(): boolean {
    return this.doneState;
  }

  push(chunk: Uint8Array): ProviderStreamDelta {
    return this.consume(this.decoder.decode(chunk, { stream: true }));
  }

  /** Flush the decoder and any complete record left in the buffer. */
  end(): ProviderStreamDelta {
    return this.consume(this.decoder.decode());
  }

  private consume(text: string): ProviderStreamDelta {
    this.buffer += text;
    const parts = this.buffer.split(/\r?\n\r?\n/u);
    this.buffer = parts.pop() ?? '';

    let content = '';
    let finishReason: ProviderFinishReason | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (const record of parts) {
      const payload = record
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('');
      if (!payload) continue;
      if (payload === '[DONE]') {
        this.doneState = true;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        // A record the provider did not finish writing is not an answer. It is
        // dropped rather than salvaged: half a JSON object cannot be trusted to
        // mean what its readable half suggests.
        continue;
      }

      const row = asRecord(parsed);
      const choice = asRecord(Array.isArray(row?.choices) ? row.choices[0] : null);
      const delta = asRecord(choice?.delta);
      if (typeof delta?.content === 'string') this.stringContentReceived = true;
      const piece = typeof delta?.content === 'string' ? delta.content : '';
      if (piece) content += piece;

      const reason = choice?.finish_reason;
      if (reason === 'stop' || reason === 'length') finishReason = reason;
      else if (typeof reason === 'string' && reason) finishReason = 'other';

      const usage = asRecord(row?.usage);
      const prompt = integerOrNull(usage?.prompt_tokens);
      const completion = integerOrNull(usage?.completion_tokens);
      if (prompt !== null) promptTokens = prompt;
      if (completion !== null) completionTokens = completion;
    }

    return { content, finishReason, promptTokens, completionTokens };
  }
}

export type ProviderFinishReason = 'stop' | 'length' | 'other';

export interface ProviderStreamDelta {
  readonly content: string;
  readonly finishReason: ProviderFinishReason | null;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
