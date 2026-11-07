import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readBoundedBody } from '@/lib/uploads/bounded-body';
import { DocumentContextError, readDocumentContext, type GektaDocumentContext } from '@/lib/gekta/document-context';
import {
  GatewayStreamWriter,
  absoluteCitationUri,
  frameText,
  type GatewayRefusal,
} from '@pc/ai-assistant-stream-contract';
import {
  GET as knowledgeGet,
  POST as knowledgePost,
} from '../public-platform-assistant/route';
import {
  resolvePreviousTopic,
  routeAssistantQuestion,
  type AssistantRoutingContext,
  type AssistantSafetyReason,
} from '@/lib/platform-v7/assistant-relevance-router';
import { buildAssistantRoutingContext } from '@/lib/platform-v7/assistant-server-context';
import { answerFarmerStarterQuestion } from '@/lib/platform-v7/public-assistant-knowledge';
import { resolveInternalStreamEndpoint, streamInternalModel } from '@/lib/platform-v7/tai-internal-stream';
import {
  renderStateForPrompt,
  type ConversationLanguage,
  type ConversationState,
} from '@/lib/platform-v7/tai-conversation-state';
import { conversationIdFrom, replayConversationState } from '@/lib/platform-v7/tai-conversation-session';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import {
  GEKTA_ANONYMOUS_COOKIE,
  GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  admitReservedAnswer,
  parseAnonymousSession,
  serializeAnonymousSession,
  type GektaAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import { hasCurrentAnonymousConsent } from '@/lib/gekta/anonymous-consent-evidence';
import { resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';
import { GEKTA_LEGAL_VERSION } from '@/lib/gekta/legal';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaForwardHeaders,
  registrationDeliveryKey,
} from '@/lib/server/gekta-auth-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TIMEOUT_MS = 130_000;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 2_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

type PublicLocale = 'ru' | 'en' | 'zh';
type PublicAnswerMode = 'verified_platform' | 'general_agro';
type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

type PublicKnowledgeAnswer = Readonly<{
  requestId: string;
  generatedAt: string;
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  mode: 'read_only';
  resolution: 'answered' | 'refused' | 'redirected';
  topic: string;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  actionAllowed: false;
  sources: readonly Readonly<{ label: string; href: string }>[];
  understanding?: Readonly<{ normalizedQuestion?: string; detectedLocale?: string }>;
}>;

type RuntimeConfig = Readonly<{
  enabled: boolean;
  endpoint: URL | null;
  secret: string;
  identity: string;
  timeoutMs: number;
}>;

type PublicEnvelope = Readonly<{
  question: string;
  questionTruncated: boolean;
  documents: readonly GektaDocumentContext[];
  locale: PublicLocale;
  context: string;
  conversationId: string;
  history: readonly HistoryTurn[];
}>;

type ArithmeticFact = Readonly<{ value: bigint; start: number; end: number }>;
type SuppliedArithmetic = Readonly<{
  operation: 'cost_per_hectare' | 'metric_yield' | 'mass_loss' | 'break_even';
  answer: string;
}>;
const ARITHMETIC_SCALE = BigInt(1000);
const ARITHMETIC_PRECISION = BigInt(1_000_000_000_000);
const ARITHMETIC_NUMBER = '(\\d{1,9}(?:[.,]\\d{1,3})?)';
const ARITHMETIC_UNIT_END = '(?![0-9_A-Za-zА-Яа-яЁё])';

function arithmeticFacts(question: string, units: string): readonly ArithmeticFact[] | null {
  const pattern = new RegExp(`(?<![0-9_A-Za-zА-Яа-яЁё.,+\\-−])${ARITHMETIC_NUMBER}\\s*(?:${units})${ARITHMETIC_UNIT_END}`, 'giu');
  const facts: ArithmeticFact[] = [];
  for (const match of question.matchAll(pattern)) {
    if (/(?:\bnegative|\bminus|минус|отрицательн[\p{L}]*|负|負)\s*$/iu.test(question.slice(Math.max(0, match.index! - 40), match.index!))) return null;
    // A three-digit suffix with a nonzero integer could be a thousands
    // separator in another locale. Leading-zero fractions are unambiguous.
    if (/[.,][0-9]{3}$/u.test(match[1]) && !/^0[.,]/u.test(match[1])) return null;
    const [whole, fraction = ''] = match[1].replace(',', '.').split('.');
    facts.push({ value: BigInt(whole) * ARITHMETIC_SCALE + BigInt(fraction.padEnd(3, '0')), start: match.index!, end: match.index! + match[0].length });
  }
  return facts;
}

function arithmeticDecimal(numerator: bigint, denominator: bigint, locale: PublicLocale): string {
  const precision = ARITHMETIC_PRECISION;
  const rounded = (numerator * precision * BigInt(2) + denominator) / (denominator * BigInt(2));
  const whole = rounded / precision;
  const fraction = String(rounded % precision).padStart(12, '0').replace(/0+$/u, '');
  return `${whole}${fraction ? `${locale === 'ru' ? ',' : '.'}${fraction}` : ''}`;
}

/**
 * Consume the entire question as a positively specified calculation and target.
 * Finding two numbers and unit words elsewhere in prose is insufficient.
 * The small supported language deliberately leaves other wording to inference.
 */
function admittedArithmeticForm(question: string): boolean {
  const n = ARITHMETIC_NUMBER;
  const rub = '(?:руб(?:лей|ля|ль|ли)?\\.?|₽|RUB)';
  const ha = '(?:гектар(?:ов|а)?|га)';
  const tonnes = '(?:тонн(?:ы|а|у)?|т)';
  const enMoney = '(?:RUB|rubles?|roubles?)';
  const enArea = '(?:hectares?|ha)';
  const ruEnd = '[.!?]?';
  const forms = [
    `(?:Для учебного расч[её]та )?бюджет(?: проверки)? ${n} ${rub} на ${n} ${ha}\\. Сколько рублей на гектар\\? Покажи формулу(?:, не добавляй рыночные цены)?\\.`,
    `(?:Рассчитай|Посчитай) (?:расходы|стоимость) на гектар: (?:общие )?(?:затраты|расходы|бюджет) ${n} ${rub} (?:на|на площади) ${n} ${ha}${ruEnd}`,
    `(?:В журнале указано )?${n} (?:центнер(?:ов|а)?|ц) (?:на гектар|/га) на площади ${n} ${ha}\\. Переведи урожайность в тонны на гектар и посчитай общий объ[её]м\\.`,
    `Переведи ${n} (?:ц/га|центнеров на гектар) на площади ${n} ${ha} в тонны на гектар и общий объ[её]м${ruEnd}`,
    `(?:В отдельном учебном примере )?было ${n} ${tonnes} продукции, потери составили ${n}%\\. Сколько тонн осталось\\? Покажи единицы и расч[её]т\\.`,
    `Сколько тонн осталось: было ${n} ${tonnes} продукции, потери ${n}%\\?`,
    `Рассчитай (?:точку )?безубыточност[ьи](?: проверки)?: затраты ${n} ${rub}, (?:подтвержд[её]нный полезный )?эффект ${n} ${rub} на единицу${ruEnd}(?: Сколько единиц нужно для покрытия затрат\\? Это условные данные\\.)?`,
    `a separate hypothetical cost is ${n} ${enMoney} over ${n} ${enArea}\\. Calculate rubles per hectare with the formula\\. These are supplied figures, not market prices\\.`,
    `Calculate (?:farm )?cost per hectare: total cost ${n} ${enMoney} over ${n} ${enArea}\\.?`,
    `Convert ${n} metric quintals?/ha over ${n} ${enArea} to tonnes?\\.?`,
    `Calculate remaining grain after a ${n}% loss from ${n} tonnes?\\.?`,
    `Calculate break-even: (?:fixed )?cost ${n} ${enMoney}, benefit ${n} ${enMoney} per unit\\.?`,
    `Calculate break-even: benefit ${n} ${enMoney} per unit, fixed cost ${n} ${enMoney}\\.?`,
    `另一个假设计算中，检查费用是${n}卢布，面积为${n}公顷。请计算每公顷费用并给出公式。数字由题目提供，不是市场价格。`,
    `计算每公顷费用：总成本${n}卢布，面积${n}公顷[。？]?`,
    `请换算${n}公担/公顷，面积${n}公顷，总共多少吨？`,
    `计算${n}吨谷物损耗${n}%后剩多少[。？]?`,
    `计算${n}吨谷物损失${n}%后剩多少[。？]?`,
    `计算盈亏平衡：成本${n}卢布，收益${n}卢布每单位[。？]?`,
    `计算盈亏平衡：收益${n}卢布每单位，成本${n}卢布[。？]?`,
  ];
  for (const form of forms) {
    const normalized = form.replaceAll(' ', '\\s+');
    if (new RegExp(`^\\s*${normalized}\\s*$`, 'iu').test(question)) return true;
  }
  return false;
}

// Only a self-contained, explicit two-input calculation takes this path.
// Ambiguous units, extra operands and contextual adjustments retain inference.
// This never forecasts a price, computes a prescription or invokes an action.
function suppliedArithmetic(envelope: PublicEnvelope, answerMode: PublicAnswerMode): SuppliedArithmetic | null {
  const question = envelope.question;
  if (envelope.questionTruncated || envelope.documents.length || envelope.history.length) return null;
  // Incidental logistics vocabulary can select platform grounding. An explicitly
  // hypothetical calculation may still use only its supplied numbers, but an
  // actual platform question must retain its verified knowledge boundary.
  if (EXPLICIT_PLATFORM_PATTERNS.some(pattern => pattern.test(question))
    || (answerMode !== 'general_agro' && !/(?:учебн|условн|hypothetic|supplied\s+figures|假设|题目提供)/iu.test(question))) return null;
  if (!admittedArithmeticForm(question)) return null;
  if (!/(?:рассчита|посчита|перевед|сколько|calculate|convert|how\s+many|what\s+is|计算|换算|多少)/iu.test(question)) return null;
  if (/[+−-]\s*\d/gu.test(question)
    || /(?:с\s+уч[её]том|учитывая|налог|НДС|скидк|дисконт|пени|\b(?:VAT|GST|interest|cwt|USD|EUR|discount|rebate|surcharge|tax|moisture)\b|adjusted\s+for|with\s+(?:tax|loss|moisture)|含税|考虑|折扣|优惠|水分|市担|亩|[$€])/iu.test(question)
    || /(?:удво|утро|вдвое|втрое|прибав|(?<!не\s)добав|выч[её]т|умнож|не\s+(?:потер|остал)|\b(?:double|triple|multiply|halve|increase|decrease|subtract|deduct|add|plus)\b|no\s+loss|not\s+(?:lost|remain)|没有损耗|没有损失|не\s*\d|not\s*\d|不是\s*\d|дозиров|смеша|dosage|mixing|剂量|混合)/iu.test(question)) return null;
  if (/(?:в\s+(?:год|месяц|сутки)|за\s+(?:год|месяц|сутки)|\/\s*(?:год|мес|сут)|per\s+(?:year|month|day)|\/\s*(?:year|month|day)|每(?:年|月|天)|ежемесяч|ежегод|около\s*\d|примерно\s*\d|\b(?:about|around)\s*\d|[≈~约]\s*\d)/iu.test(question)) return null;
  const money = arithmeticFacts(question, 'руб(?:лей|ля|ль|ли)?\\.?|RUB|rubles?|roubles?|₽|卢布');
  const area = arithmeticFacts(question, 'гектар(?:ов|а)?|га|hectares?|ha|公顷');
  const yieldRate = arithmeticFacts(question, '(?:центнер(?:ов|а)?|ц)\\s*(?:/|на)\\s*(?:гектар(?:ов|а)?|га)|metric\\s+quintals?\\s*(?:/|per)\\s*(?:hectares?|ha)|公担\\s*/\\s*公顷');
  const mass = arithmeticFacts(question, 'тонн(?:ами|ы|а|у)?|т|tonnes?|tons?|t|吨');
  const percent = arithmeticFacts(question, '%|процент(?:ов|а)?|percent');
  if (!money || !area || !yieldRate || !mass || !percent) return null;
  const locale = envelope.locale;
  const display = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const choose = (ru: string, en: string, zh: string) => locale === 'en' ? en : locale === 'zh' ? zh : ru;
  const monetaryRateBasis = (fact: ArithmeticFact) => /^\s*(?:\/|per\s|на\s+(?:гектар|тонн|единиц|год|месяц)|每)/iu.test(question.slice(fact.end));
  const exactOperands = (facts: readonly ArithmeticFact[]) => {
    const ordered = [...facts].sort((left, right) => left.start - right.start);
    if (ordered.some((fact, index) => index > 0 && fact.start < ordered[index - 1].end)) return false;
    let remainder = question;
    for (const fact of [...ordered].reverse()) remainder = remainder.slice(0, fact.start) + ' '.repeat(fact.end - fact.start) + remainder.slice(fact.end);
    return !/\p{N}/u.test(remainder);
  };

  if (yieldRate.length === 1 && area.length === 1 && !money.length && !mass.length && !percent.length && exactOperands([...yieldRate, ...area])) {
    if (!/(?:тонн|\btonnes?\b|\btons?\b|吨)/iu.test(question)
      || /(?:килограмм|\bkg\b|\bkilogram|千克|公斤)/iu.test(question)) return null;
    const rate = yieldRate[0].value, hectares = area[0].value;
    const tonnesPerHectare = arithmeticDecimal(rate, ARITHMETIC_SCALE * BigInt(10), locale);
    const total = arithmeticDecimal(rate * hectares, ARITHMETIC_SCALE * ARITHMETIC_SCALE * BigInt(10), locale);
    return { operation: 'metric_yield', answer: choose(
      `1 ц = 100 кг = 0,1 т.\n${display(rate)} ц/га × 0,1 = ${tonnesPerHectare} т/га.\n${tonnesPerHectare} т/га × ${display(hectares)} га = ${total} т.`,
      `1 metric quintal = 100 kg = 0.1 t.\n${display(rate)} metric quintals/ha × 0.1 = ${tonnesPerHectare} t/ha.\n${tonnesPerHectare} t/ha × ${display(hectares)} ha = ${total} t.`,
      `1 公担 = 100 千克 = 0.1 吨。\n${display(rate)} 公担/公顷 × 0.1 = ${tonnesPerHectare} 吨/公顷。\n${tonnesPerHectare} 吨/公顷 × ${display(hectares)} 公顷 = ${total} 吨。`,
    ) };
  }

  if (mass.length === 1 && percent.length === 1 && !money.length && !area.length && !yieldRate.length
    && /(?:потер|остал|loss|remain|损耗|损失|剩)/iu.test(question) && exactOperands([...mass, ...percent])) {
    if (!/(?:сколько[^.?!]{0,30}остал|(?:посчита|рассчита)[^.?!]{0,30}остат|how\s+many[^.?!]{0,30}remain|calculate[^.?!]{0,30}remain|(?:剩|余)[^。？！]{0,8}多少)/iu.test(question)
      || /(?:изначальн|первоначальн|исходн|original|initial|starting|原来|最初)/iu.test(question)) return null;
    const beforeMass = question.slice(Math.max(0, mass[0].start - 64), mass[0].start);
    const afterMass = question.slice(mass[0].end);
    const massFollowsQuestion = /(?:сколько[^.?!:]{0,30}остал[\p{L}]*|how\s+many[^.?!:]{0,30}remain[\p{L}]*)\s*[:：?]\s*$/iu.test(beforeMass);
    if ((!massFollowsQuestion && /(?:остал[\p{L}]*|остаток|remain(?:ing|s)?(?:\s+(?:mass|grain))?|剩余|剩下|还剩)\s*(?:is|was|为|是|[:：])?\s*$/iu.test(beforeMass))
      || /^\s*(?:остал[\p{L}]*|remain(?:s|ing)?(?=$|[^\p{L}\p{N}_])|left(?=$|[^\p{L}\p{N}_])|剩)/iu.test(afterMass)) return null;
    // The percentage must describe a loss, not the fraction that remains.
    const beforeRate = question.slice(Math.max(0, percent[0].start - 64), percent[0].start);
    const afterRate = question.slice(percent[0].end);
    if (/(?:остал[\p{L}]*|остаток|remain(?:ing|s)?|剩余|剩下|还剩)\s*(?:is|was|为|是|[:：])?\s*$/iu.test(beforeRate)
      || !(/(?:потер[\p{L}]*\s*(?:составил[аио]?|равн[аы]?|[:：=])?|(?:loss(?:es)?|lost)(?:\s+rate)?\s*(?:of|is|was|at|[:：=])?|损耗率?|损失率?)\s*(?:为|是)?\s*$/iu.test(beforeRate)
        || /^\s*(?:потерь|потери|loss(?:es)?(?=$|[^\p{L}\p{N}_])|损耗|损失)/iu.test(afterRate))) return null;
    const initial = mass[0].value, lossRate = percent[0].value;
    if (lossRate > BigInt(100) * ARITHMETIC_SCALE) return { operation: 'mass_loss', answer: choose('Для расчёта остатка потери должны быть от 0 до 100%. Уточни процент потерь.', 'The loss percentage must be between 0 and 100. Please clarify the loss rate.', '损耗率必须在 0% 到 100% 之间。请核对损耗率。') };
    const denominator = BigInt(100) * ARITHMETIC_SCALE * ARITHMETIC_SCALE;
    const lost = arithmeticDecimal(initial * lossRate, denominator, locale);
    const remaining = arithmeticDecimal(initial * (BigInt(100) * ARITHMETIC_SCALE - lossRate), denominator, locale);
    return { operation: 'mass_loss', answer: choose(
      `Потери: ${display(initial)} т × ${display(lossRate)}% ÷ 100 = ${lost} т.\nОсталось: ${display(initial)} т − ${lost} т = ${remaining} т.`,
      `Loss: ${display(initial)} t × ${display(lossRate)}% ÷ 100 = ${lost} t.\nRemaining: ${display(initial)} t − ${lost} t = ${remaining} t.`,
      `损耗：${display(initial)} 吨 × ${display(lossRate)}% ÷ 100 = ${lost} 吨。\n剩余：${display(initial)} 吨 − ${lost} 吨 = ${remaining} 吨。`,
    ) };
  }

  if (money.length === 1 && area.length === 1 && !yieldRate.length && !mass.length && !percent.length
    && /(?:на\s+гектар|\/\s*га(?=$|[^\p{L}\p{N}_])|per\s+hectare|per\s+ha(?=$|[^\p{L}\p{N}_])|每公顷)/iu.test(question)
    && exactOperands([...money, ...area])) {
    if (monetaryRateBasis(money[0])) return null;
    const cost = money[0].value, hectares = area[0].value;
    if (hectares === BigInt(0)) return { operation: 'cost_per_hectare', answer: choose('Чтобы рассчитать стоимость на гектар, нужна площадь больше нуля. Уточни площадь.', 'Cost per hectare needs an area greater than zero. Please clarify the area.', '计算每公顷费用需要大于零的面积。请核对面积。') };
    const result = arithmeticDecimal(cost, hectares, locale);
    const equals = cost * ARITHMETIC_PRECISION % hectares === BigInt(0) ? '=' : '≈';
    return { operation: 'cost_per_hectare', answer: choose(
      `По указанным данным: ${display(cost)} ₽ ÷ ${display(hectares)} га ${equals} ${result} ₽/га.`,
      `Using your figures: ${display(cost)} RUB ÷ ${display(hectares)} ha ${equals} ${result} RUB/ha.`,
      `按你提供的数据：${display(cost)} 卢布 ÷ ${display(hectares)} 公顷 ${equals} ${result} 卢布/公顷。`,
    ) };
  }

  if (money.length === 2 && !area.length && !mass.length && !percent.length && !yieldRate.length
    && /(?:безубыточн|покрыт[^.?!]{0,40}затрат|break[ -]?even|cover[^.?!]{0,40}cost|盈亏平衡|收回成本)/iu.test(question)
    && /(?:на\s+единиц|per\s+unit|每单位)/iu.test(question) && exactOperands(money)) {
    // Bind the operands to their labels, not their order in the sentence.
    const cost = money.find(fact => /(?:затрат[\p{L}]*|стоимость|costs?|expense|成本)\s*[:：]?\s*$/iu.test(question.slice(Math.max(0, fact.start - 36), fact.start)));
    const benefit = money.find(fact => fact !== cost && /(?:эффект|прибыл[\p{L}]*|benefit|contribution|收益)\s*[:：]?\s*$/iu.test(question.slice(Math.max(0, fact.start - 36), fact.start)));
    if (!cost || !benefit) return null;
    if (!/^\s*(?:на\s+единиц[\p{L}]*|per\s+unit(?=$|[^\p{L}\p{N}_])|每单位|\/\s*(?:ед(?:иниц[\p{L}]*)?\.?|unit|单位)(?=$|[^\p{L}\p{N}_]))/iu.test(question.slice(benefit.end))) return null;
    // A per-unit expense is not a fixed cost to be recovered. Preserve inference
    // when either monetary amount has an additional or different unit basis.
    if (monetaryRateBasis(cost)
      || /(?:на\s+тонн|\/\s*т(?=$|[^\p{L}\p{N}_])|per\s+ton|每吨)/iu.test(question)) return null;
    if (benefit.value === BigInt(0)) return { operation: 'break_even', answer: choose('При нулевом эффекте на единицу делить затраты на эффект нельзя. Уточни положительный эффект на единицу.', 'A zero benefit per unit cannot be used as the divisor. Please clarify a positive benefit per unit.', '每单位收益为零时不能作为除数。请核对大于零的每单位收益。') };
    const ratio = arithmeticDecimal(cost.value, benefit.value, locale);
    const equals = cost.value * ARITHMETIC_PRECISION % benefit.value === BigInt(0) ? '=' : '≈';
    const units = (cost.value + benefit.value - BigInt(1)) / benefit.value;
    return { operation: 'break_even', answer: choose(
      `Точка покрытия: ${display(cost.value)} ₽ ÷ ${display(benefit.value)} ₽/ед. ${equals} ${ratio} ед.\nДля покрытия затрат нужно не менее ${units} целых единиц.`,
      `Break-even: ${display(cost.value)} RUB ÷ ${display(benefit.value)} RUB/unit ${equals} ${ratio} units.\nCovering the cost needs at least ${units} whole units.`,
      `盈亏平衡：${display(cost.value)} 卢布 ÷ ${display(benefit.value)} 卢布/单位 ${equals} ${ratio} 单位。\n覆盖成本至少需要 ${units} 个完整单位。`,
    ) };
  }
  return null;
}

const SENSITIVE_INPUT_PATTERNS = [
  /\b(?:пароль|password|api[\s_-]?key|ключ\s+api|токен|token|secret)\s*[:=]\s*\S{6,}/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
] as const;

const GREETING_PATTERNS = [
  /^(?:привет|здравствуй(?:те)?|доброе\s+(?:утро|день|вечер)|как\s+дела|спасибо|благодарю)[!.?\s]*$/iu,
  /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|thanks?|thank\s+you)[!.?\s]*$/iu,
  /^(?:你好|您好|早上好|下午好|晚上好|谢谢)[！。？\s]*$/u,
] as const;

const EXPLICIT_PLATFORM_PATTERNS = [
  /(?:прозрачн\w*\s+цен\w*|transparent\s+price|透明价格)/iu,
  /(?:эта|данная|ваша|наша)\s+(?:платформа|система)|(?:на|в)\s+(?:этой|вашей|нашей)\s+(?:платформе|системе)/iu,
  /(?:личн\w*\s+кабинет|зарегистрир\w*|регистрац\w*|подключить\s+организац\w*|роль\w*\s+на\s+платформе)/iu,
  /(?:как\s+работает\s+(?:сделка|аукцион|приемка|приёмка)\s+(?:на|в)\s+(?:платформе|системе))/iu,
  /(?:your\s+platform|this\s+platform|the\s+platform|workspace|sign\s*up|register|platform\s+capabilit)/iu,
  /(?:你们的平台|本平台|平台中|注册|工作台)/u,
] as const;

// A user can ask whether to sell now using storage cost inputs already supplied
// by the user. That decision phrase alone is not fresh evidence, but it may be
// ignored only when an explicit storage rate exists in this user conversation.
const SUPPLIED_INPUT_DECISION_NOW_PATTERN = /(?:\b(?:продавать|продать)\s+(?:ли\s+)?сейчас\b|\b(?:sell|selling)\s+now\b|(?:现在卖|现在出售))/giu;
const EXPLICIT_STORAGE_RATE_PATTERN = /(?:(?:хранени\w*|стоимост\w*\s+хранени\w*)[^\n]{0,48}\d{1,7}(?:[.,]\d{1,2})?\s*(?:руб(?:лей|ля|ль)?\.?|₽|RUB)\s*(?:за\s*тонн[уы]|\/\s*т(?:онн[уы])?)\s*(?:в\s*месяц|\/\s*мес(?:яц)?)|(?<![\p{L}\p{M}\p{N}_])storage(?=$|[^\p{L}\p{M}\p{N}_])[^\n\p{N}]{0,48}(?<![\d.,])\d{1,7}(?:[.,]\d{1,2})?\s*(?:RUB|rubles?|roubles?|₽|USD|US\$|\$|EUR|€)\s*(?:per\s+ton(?:ne)?s?|\/\s*(?:t|ton(?:ne)?s?))\s*(?:per\s+month|\/\s*(?:month|mo))(?=$|[^\p{L}\p{M}\p{N}_]))/iu;

const CURRENT_EVIDENCE_PATTERNS = [
  /(?:сегодня|сейчас|на\s+данный\s+момент|последн\w*|свеж\w*|актуальн\w*|текущ\w*)/iu,
  /(?:^|[^\p{L}\p{M}\p{N}_])(?:новост|погод|курс|пошлин|ставк|котировк|индекс|статистик)[\p{L}\p{M}]*(?=$|[^\p{L}\p{M}\p{N}_])/iu,
  /(?:цена|стоимост\w*)\s+(?:сегодня|сейчас|на\s+сегодня|в\s+регионе)/iu,
  /(?:^|[^\p{L}\p{M}\p{N}_])(?:today|now|current(?:ly)?|latest|recent(?:ly)?|news|weather|exchange\s+rates?|tariffs?|dut(?:y|ies)|statistics?)(?=$|[^\p{L}\p{M}\p{N}_])/iu,
  /(?:今天|当前|最新|新闻|天气|汇率|关税|统计)/u,
] as const;

// A correction is an authority boundary for raw chat history. The derived
// ConversationState already applies "newest explicit statement wins"; sending
// contradictory turns from before the correction alongside that state gives a
// small local model two competing subjects and can make stale history win again.
const CORRECTION_HISTORY_PATTERNS = [
  /(?:^|\s)нет[,;.\s]/iu,
  /(?:не\s+\w+,?\s*а\s)|(?:речь\s+(?:идёт|идет|про|о))|(?:я\s+имел\s+в\s+виду)|(?:на\s+самом\s+деле)|(?:ошиб(?:ся|лась|лись))/iu,
  /(?:^|\s)no[,;.\s]|(?:i\s+meant)|(?:actually)|(?:rather\s+than)|(?:not\s+\w+\s+but)|(?:i\s+was\s+wrong)/iu,
  /(?:不是)|(?:我是说)|(?:其实)|(?:应该是)|(?:我错了)/u,
] as const;

export async function GET(request: NextRequest) {
  return knowledgeGet(request);
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('stream') !== '1') return knowledgePost(request);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return knowledgePost(request);

  const body = await readBoundedBody(request.body, 196_608);
  if (body === null) return NextResponse.json({ code: 'DOCUMENT_CONTEXT_TOO_LARGE' }, { status: 413 });
  const rawBody = new TextDecoder().decode(body);
  let envelope: PublicEnvelope;
  try { envelope = readPublicEnvelope(rawBody); }
  catch (error) {
    if (!(error instanceof DocumentContextError)) throw error;
    return NextResponse.json({ code: error.status === 413 ? 'DOCUMENT_CONTEXT_TOO_LARGE' : 'DOCUMENT_CONTEXT_INVALID' }, { status: error.status });
  }
  if (!envelope.question) return knowledgePost(rebuildRequestWithoutStream(request, rawBody));

  const admission = envelope.context === 'gekta-standalone'
    ? await authorizeGektaAnswer(request)
    : { response: null, anonymousSession: null };
  if (admission.response) return admission.response;
  const admitted = (response: NextResponse) => applyGektaAdmission(response, admission.anonymousSession);

  const routingContext = await buildAssistantRoutingContext(request, {
    locale: envelope.locale,
    recentMessages: envelope.history,
    previousTopic: resolvePreviousTopic(envelope.history),
    hasAttachment: envelope.documents.length > 0,
    semanticHint: null,
  });
  const routedQuestion = envelope.question;
  const outcome = routeAssistantQuestion(routedQuestion, routingContext);
  let answerMode = resolveAnswerMode(routedQuestion, outcome);
  const locale = envelope.locale;

  if (containsSensitiveInput(envelope.question, envelope.history)
    || envelope.documents.some((document) => containsSensitiveInput(`${document.name}\n${document.text}`, []))) {
    return admitted(streamDirectAnswer(sensitiveInputCopy(locale), {
      source: 'policy',
      answerMode,
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: ['SENSITIVE_INPUT_BLOCKED'],
    }));
  }

  if (outcome.decision === 'BLOCK_SAFETY') {
    return admitted(streamDirectAnswer(safetyBoundaryCopy(locale, outcome.safetyReason), {
      source: 'policy',
      answerMode,
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: ['SAFETY_BOUNDARY_BLOCKED'],
    }));
  }

  // Only an explicit unrelated subject takes this fast path. A lexical miss
  // remains model-admitted so specialist terminology is not a refusal reason.
  if (outcome.decision === 'REDIRECT_UNRELATED' && outcome.signals.includes('unrelated_term')) {
    return admitted(streamDirectAnswer(unrelatedTopicCopy(locale), {
      source: 'policy',
      answerMode: 'general_agro',
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: ['TOPIC_REDIRECTED'],
    }));
  }

  if (!envelope.documents.length && GREETING_PATTERNS.some((pattern) => pattern.test(envelope.question.trim()))) {
    return admitted(streamDirectAnswer(greetingCopy(locale, envelope.question), {
      source: 'policy',
      answerMode: 'general_agro',
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: [],
    }));
  }

  const arithmetic = suppliedArithmetic(envelope, answerMode);
  if (arithmetic) {
    return admitted(streamDirectAnswer(arithmetic.answer, {
      source: 'deterministic_calculator',
      answerMode: 'general_agro',
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      calculator: { version: 'supplied-input-v1', operation: arithmetic.operation },
      safetyFlags: [],
    }));
  }

  // The visible starter cards have reviewed public guidance. Serve their exact
  // first-turn answers without model queueing; contextual follow-ups keep inference.
  const starter = !envelope.documents.length && envelope.history.length === 0
    ? answerFarmerStarterQuestion(envelope.question, locale)
    : null;
  if (starter) {
    return admitted(streamDirectAnswer(starter.answer, {
      source: 'verified_knowledge',
      answerMode: 'general_agro',
      knowledgeVersion: starter.knowledgeVersion,
      currentDataRequired: requiresCurrentEvidence(envelope.question, envelope.history),
      modelIdentity: null,
      truncated: false,
      safetyFlags: [],
    }));
  }

  let grounding: PublicKnowledgeAnswer;
  if (answerMode === 'verified_platform') {
    const groundingResponse = await knowledgePost(rebuildRequestWithoutStream(request, rawBody, true));
    if (!groundingResponse.ok) return admitted(groundingResponse);
    try {
      grounding = await groundingResponse.json() as PublicKnowledgeAnswer;
    } catch {
      return admitted(NextResponse.json(
        { code: 'PUBLIC_ASSISTANT_GROUNDING_INVALID', message: 'Verified public grounding is unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      ));
    }
    if (grounding.resolution === 'redirected') {
      answerMode = 'general_agro';
      grounding = generalAgroGrounding(locale);
    }
  } else {
    grounding = generalAgroGrounding(locale);
  }

  return admitted(streamModelFirstAnswer(request, grounding, envelope, routingContext, answerMode));
}

async function authorizeGektaAnswer(request: NextRequest): Promise<{
  response: NextResponse | null;
  anonymousSession: GektaAnonymousSession | null;
}> {
  const ticket = String(request.headers.get('x-gekta-answer-ticket') || '').trim();
  if (!ticket || ticket.length > 256) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ANSWER_RESERVATION_REQUIRED' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }

  if (ticket === 'account') {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
    const upstream = gektaApiBase();
    if (!accessToken || !upstream) {
      return {
        response: NextResponse.json(
          { code: accessToken ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ACCOUNT_SESSION_REQUIRED' },
          { status: accessToken ? 503 : 401, headers: { 'Cache-Control': 'no-store' } },
        ),
        anonymousSession: null,
      };
    }
    try {
      const entitlement = await fetch(`${upstream}/gekta/entitlement`, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
      });
      const payload = await entitlement.json().catch(() => null) as { entitlement?: { canAsk?: boolean } } | null;
      if (!entitlement.ok || payload?.entitlement?.canAsk !== true) {
        const status = entitlement.status === 401 || entitlement.status === 403
          ? entitlement.status
          : entitlement.ok ? 403 : 503;
        return {
          response: NextResponse.json(
            { code: status === 503 ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ACCESS_DENIED' },
            { status, headers: { 'Cache-Control': 'no-store' } },
          ),
          anonymousSession: null,
        };
      }
      return { response: null, anonymousSession: null };
    } catch {
      return {
        response: NextResponse.json(
          { code: 'GEKTA_SERVICE_UNAVAILABLE' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        ),
        anonymousSession: null,
      };
    }
  }

  const current = parseAnonymousSession(request.cookies.get(GEKTA_ANONYMOUS_COOKIE)?.value);
  if (!current || !resolveAnonymousEntitlement({ used: current.used }, new Date()).canAsk) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ACCESS_DENIED' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }
  const consumed = hasCurrentAnonymousConsent(current) ? admitReservedAnswer(current, ticket, GEKTA_LEGAL_VERSION) : null;
  if (!consumed) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ANSWER_RESERVATION_INVALID' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }

  const durableAdmission = await consumeAnonymousReservation(request, current.sid, ticket);
  if (durableAdmission !== 'allowed') {
    const unavailable = durableAdmission === 'unavailable';
    return {
      response: NextResponse.json(
        { code: unavailable ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ANSWER_RESERVATION_INVALID' },
        { status: unavailable ? 503 : 409, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }
  return { response: null, anonymousSession: consumed };
}

async function consumeAnonymousReservation(
  request: NextRequest,
  sid: string,
  ticket: string,
): Promise<'allowed' | 'denied' | 'unavailable'> {
  const upstream = gektaApiBase();
  const deliveryKey = registrationDeliveryKey();
  if (!upstream || deliveryKey.length < 32) return 'unavailable';

  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  try {
    const response = await fetch(`${upstream}/gekta/internal/anonymous-answer/admit`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId, { deliveryKey }),
      body: JSON.stringify({ sid, ticket }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) return 'unavailable';
    if (!response.ok) return 'unavailable';
    const payload = await response.json().catch(() => null) as { allowed?: boolean } | null;
    return payload?.allowed === true ? 'allowed' : 'denied';
  } catch {
    return 'unavailable';
  }
}

function applyGektaAdmission(
  response: NextResponse,
  anonymousSession: GektaAnonymousSession | null,
): NextResponse {
  if (!anonymousSession) return response;
  response.cookies.set(GEKTA_ANONYMOUS_COOKIE, serializeAnonymousSession(anonymousSession), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

function resolveAnswerMode(
  question: string,
  outcome: ReturnType<typeof routeAssistantQuestion>,
): PublicAnswerMode {
  const normalized = normalizeIntent(question);
  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) return 'general_agro';
  if (outcome.section || outcome.signals.includes('platform_term')) return 'verified_platform';
  if (EXPLICIT_PLATFORM_PATTERNS.some((pattern) => pattern.test(normalized))) return 'verified_platform';

  // A self-contained agricultural subject is not a platform follow-up merely
  // because it is short or because an older platform topic exists in history.
  // This protects questions such as "Как хранить зерно после уборки?" from
  // being answered with stale Transparent Price copy.
  if (outcome.signals.includes('agro_term')) return 'general_agro';
  // The relevance router owns contextual inheritance. Length and old platform
  // history alone cannot turn a current professional subject into platform facts.

  // Model-first boundary: everything not explicitly identified as a platform
  // fact is sent to the model. The model system prompt handles greetings,
  // agriculture, agribusiness and adjacent operations, and redirects other topics.
  // A lexical miss must never prevent a legitimate domain question from inference.
  return 'general_agro';
}

function streamModelFirstAnswer(
  request: NextRequest,
  grounding: PublicKnowledgeAnswer,
  envelope: PublicEnvelope,
  routingContext: AssistantRoutingContext,
  answerMode: PublicAnswerMode,
) {
  const encoder = new TextEncoder();
  const streamId = randomUUID();
  const runtimeConfig = readRuntimeConfig();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const writer = new GatewayStreamWriter(
        (chunk) => { if (!closed) controller.enqueue(encoder.encode(chunk)); },
        'public',
        streamId,
      );
      const finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const cancel = () => {
        writer.fail('CANCELLED', 'The reader cancelled the answer.');
        finish();
      };

      if (request.signal.aborted) {
        cancel();
        return;
      }
      request.signal.addEventListener('abort', cancel, { once: true });
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });

      const run = async () => {
        const locale = resolveLocale(grounding, envelope.locale);
        const currentDataRequired = answerMode === 'general_agro' && requiresCurrentEvidence(envelope.question, envelope.history);

        // Rebuilt from this request's own history every time. A short follow-up
        // resolves against the subject this state carries instead of being sent
        // to the model as a bare "а если весной?" with twelve raw turns behind
        // it and no statement of what the conversation is actually about.
        const conversationState: ConversationState = replayConversationState({
          conversationId: envelope.conversationId,
          history: envelope.history,
          message: envelope.question,
          requestedLanguage: locale as ConversationLanguage,
          dealContext: null,
        });

        if (grounding.resolution === 'refused') {
          writer.fail(
            'ABSTAINED_NO_DATA',
            grounding.answer || 'The requested private or write capability is unavailable in public mode.',
          );
          return;
        }

        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_UNAVAILABLE');
          } else {
            writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }

        const payload = {
          question: grounding.understanding?.normalizedQuestion || envelope.question || grounding.title,
          originalQuestion: envelope.question,
          documents: envelope.documents,
          locale,
          answerMode,
          currentDataRequired,
          // Raw turns before the newest explicit correction are retired from the
          // model prompt. They remain available to state replay above, where the
          // newest statement deterministically overwrites stale subject facts.
          history: historyAfterLatestCorrection(envelope.history),
          // Public contour: no deal, tenant, organization or role context is
          // ever derived into this state, so none can travel with it.
          conversationState: renderStateForPrompt(conversationState),
          cabinetRole: routingContext.role,
          page: routingContext.page,
          selectedObject: routingContext.selectedObject,
          grounding: {
            knowledgeVersion: grounding.knowledgeVersion,
            topic: grounding.topic,
            title: grounding.title,
            answer: grounding.answer,
            facts: grounding.facts,
            maturity: grounding.maturity,
            confidence: grounding.confidence,
            sources: grounding.sources,
          },
        };

        // Sources first, so a reader has the citation list while the answer is
        // still arriving rather than only once it has finished.
        if (answerMode === 'verified_platform') emitSources(writer, grounding.sources);

        let relayed = 0;
        let assessment: string | null = null;
        let terminal: { complete: boolean; refusal: GatewayRefusal | null } | null = null;

        try {
          for await (const event of streamInternalModel(
            { endpoint: runtimeConfig.endpoint, secret: runtimeConfig.secret, identity: runtimeConfig.identity, timeoutMs: runtimeConfig.timeoutMs },
            payload,
            request.signal,
          )) {
            if (event.kind === 'token') {
              // Forwarded the moment it arrives. Nothing accumulates here: the
              // whole point of this path is that the reader sees the model's
              // first sentence while the model is still writing the rest.
              relayed += 1;
              if (!writer.emit({ event: 'token', text: event.text })) return;
              continue;
            }
            if (event.kind === 'assessment') {
              assessment = event.summary;
              continue;
            }
            if (event.kind === 'terminal') {
              terminal = { complete: event.complete, refusal: event.refusal };
              break;
            }
          }
        } catch {
          if (request.signal.aborted) return;
          terminal = { complete: false, refusal: 'UPSTREAM_ERROR' };
        }

        if (request.signal.aborted) return;

        // Falling back after tokens have already been relayed would splice a
        // second, unrelated answer onto a partial one, so the fallback is only
        // available while nothing has reached the reader.
        if (!terminal || !terminal.complete || relayed === 0) {
          if (relayed > 0) {
            writer.fail(terminal?.refusal ?? 'UPSTREAM_ERROR', modelUnavailableCopy(locale));
            return;
          }
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_FALLBACK');
          } else {
            writer.fail(terminal?.refusal ?? 'UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }

        writer.emit({
          event: 'assessment',
          summary: JSON.stringify({
            source: 'local_qwen',
            answerMode,
            currentDataRequired,
            streaming: 'incremental',
            upstream: assessment ? safeAssessment(assessment) : null,
          }),
          operationalStatus: 'NOT_ATTESTED',
        });
        writer.complete();
      };

      void run()
        .catch(() => {
          if (!request.signal.aborted) writer.fail('UPSTREAM_ERROR', 'The public assistant could not complete the answer.');
        })
        .finally(() => {
          request.signal.removeEventListener('abort', cancel);
          finish();
        });
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function streamDirectAnswer(answer: string, assessment: Readonly<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  const writerId = randomUUID();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = new GatewayStreamWriter((chunk) => controller.enqueue(encoder.encode(chunk)), 'public', writerId);
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });
      emitDirectAnswer(writer, answer, assessment);
      controller.close();
    },
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function emitSources(
  writer: GatewayStreamWriter,
  sources: readonly Readonly<{ label: string; href: string }>[],
): void {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || null;
  for (const source of sources) {
    const uri = absoluteCitationUri(source.href, base);
    if (!uri) continue;
    if (!writer.emit({ event: 'citation', sourceId: source.href, title: source.label || source.href, uri })) return;
  }
}

function emitDirectAnswer(
  writer: GatewayStreamWriter,
  answer: string,
  assessment: Readonly<Record<string, unknown>>,
): void {
  for (const chunk of frameText(answer)) {
    if (!writer.emit({ event: 'token', text: chunk })) return;
  }
  writer.emit({ event: 'assessment', summary: JSON.stringify(assessment), operationalStatus: 'NOT_ATTESTED' });
  writer.complete();
}

function emitGroundedFallback(
  writer: GatewayStreamWriter,
  grounding: PublicKnowledgeAnswer,
  answerMode: PublicAnswerMode,
  currentDataRequired: boolean,
  safetyFlag: string,
): void {
  emitSources(writer, grounding.sources);
  emitDirectAnswer(writer, grounding.answer, {
    source: 'verified_knowledge',
    answerMode,
    currentDataRequired,
    modelIdentity: null,
    truncated: false,
    safetyFlags: [safetyFlag],
  });
}

function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const enabled = (environment.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED || '').trim() === 'true';
  const secret = (environment.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  const identity = (environment.TAI_RESTRICTED_QWEN_MODEL_IDENTITY || '').trim();
  const rawBase = (environment.TAI_INTERNAL_API_BASE_URL || environment.NEXT_PUBLIC_API_URL || '').trim();
  const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 150_000);
  if (!enabled) return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  if (secret.length < 32 || !identity || !rawBase) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }

  let base: URL;
  try { base = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`); } catch {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  const allowedHosts = (environment.TAI_INTERNAL_API_ALLOWED_HOSTS || '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.includes(base.hostname.toLowerCase())) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  return Object.freeze({
    enabled: true,
    endpoint: resolveInternalStreamEndpoint(base),
    secret,
    identity,
    timeoutMs,
  });
}

function generalAgroGrounding(locale: PublicLocale): PublicKnowledgeAnswer {
  const copy = locale === 'en'
    ? {
        title: 'Agriculture, agribusiness and practical assistance',
        answer: 'Answer agriculture, agribusiness and reasonably adjacent professional questions directly. Briefly and respectfully redirect unrelated topics to these subjects. Use stable knowledge, identify missing inputs and do not invent current facts.',
        maturity: 'General read-only assistance. Critical agronomic, veterinary, machinery, legal and financial decisions require confirmed inputs and the appropriate qualified review.',
      }
    : locale === 'zh'
      ? {
          title: '农业、农业商业与实用协助',
          answer: '直接回答农业、农业商业及合理相关的专业问题。对于无关话题，简短、礼貌地引导回这些领域。使用稳定知识，指出缺失信息，不得编造当前事实。',
          maturity: '通用只读协助。关键农艺、兽医、机械、法律和财务决策需要确认输入并由相应的合格专业人员复核。',
        }
      : {
          title: 'Сельское хозяйство, агробизнес и практическая помощь',
          answer: 'Отвечай по существу на вопросы о сельском хозяйстве, агробизнесе и обоснованно связанных рабочих задачах. От посторонних тем кратко и уважительно возвращай к этим направлениям. Используй устойчивые знания, обозначай недостающие исходные данные и не выдумывай актуальные факты.',
          maturity: 'Общая помощь в режиме только чтения. Критические агрономические, ветеринарные, технические, юридические и финансовые решения требуют подтверждённых исходных данных и профильной проверки.',
        };
  return Object.freeze({
    requestId: `general-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    knowledgeVersion: 'gekta-agro-ru-policy.2026-09-30.v1',
    dataMode: 'public_knowledge',
    mode: 'read_only',
    resolution: 'answered',
    topic: 'general_agro',
    title: copy.title,
    answer: copy.answer,
    facts: Object.freeze([]),
    maturity: copy.maturity,
    confidence: 'medium',
    actionAllowed: false,
    sources: Object.freeze([]),
  });
}

function readPublicEnvelope(rawBody: string): PublicEnvelope {
  try {
    const row = asRecord(JSON.parse(rawBody));
    if (!row) return emptyEnvelope();
    const fullQuestion = typeof row.message === 'string' ? row.message.trim() : '';
    const question = fullQuestion.slice(0, 1_200);
    const locale: PublicLocale = row.locale === 'en' || row.locale === 'zh' ? row.locale : 'ru';
    const context = typeof row.context === 'string' ? row.context.trim().slice(0, 120) : 'platform';
    const history = normalizeHistory(row.history);
    return Object.freeze({
      question,
      questionTruncated: fullQuestion.length > question.length,
      documents: readDocumentContext(row.documents),
      locale,
      context,
      // A label only: nothing is looked up by it, so a forged value reaches no
      // context beyond the history this same request already carried.
      conversationId: conversationIdFrom(row.conversationId, `${context}-${locale}-${history.length}`),
      history,
    });
  } catch (error) {
    if (error instanceof DocumentContextError) throw error;
    return emptyEnvelope();
  }
}

function emptyEnvelope(): PublicEnvelope {
  return Object.freeze({
    question: '',
    questionTruncated: false,
    documents: Object.freeze([]),
    locale: 'ru',
    context: 'platform',
    conversationId: conversationIdFrom(null, 'empty-envelope'),
    history: [],
  });
}

/**
 * The upstream assessment, reduced to what the public contour may repeat.
 *
 * It is model-adjacent operational metadata, so it is parsed and re-projected
 * rather than forwarded verbatim: a field added upstream should not reach a
 * public reader because nobody remembered this relay existed.
 */
function safeAssessment(summary: string): Record<string, unknown> | null {
  try {
    const row = JSON.parse(summary) as Record<string, unknown>;
    return {
      finishReason: typeof row.finishReason === 'string' ? row.finishReason : 'other',
      truncated: row.truncated === true,
      safetyFlags: Array.isArray(row.safetyFlags) ? row.safetyFlags.filter((flag) => typeof flag === 'string').slice(0, 12) : [],
    };
  } catch {
    return null;
  }
}

function normalizeHistory(value: unknown): readonly HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: HistoryTurn[] = [];
  let total = 0;
  // Budget from the newest valid turn, then restore chronological wire order.
  // Filling from the oldest turn silently discarded the latest correction.
  for (const item of value.slice(-MAX_HISTORY_TURNS).reverse()) {
    const row = asRecord(item);
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const text = typeof row?.text === 'string'
      ? row.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ').trim().slice(0, MAX_HISTORY_TURN_CHARS)
      : '';
    if (!role || !text) continue;
    if (total + text.length > MAX_HISTORY_TOTAL_CHARS) break;
    turns.push(Object.freeze({ role, text }));
    total += text.length;
  }
  return Object.freeze(turns.reverse());
}

function historyAfterLatestCorrection(history: readonly HistoryTurn[]): readonly HistoryTurn[] {
  let correctionIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const turn = history[index];
    if (turn.role !== 'user') continue;
    if (CORRECTION_HISTORY_PATTERNS.some((pattern) => pattern.test(turn.text))) correctionIndex = index;
  }
  return correctionIndex >= 0 ? Object.freeze(history.slice(correctionIndex)) : history;
}

function requiresCurrentEvidence(
  question: string,
  history: readonly HistoryTurn[] = [],
): boolean {
  const normalized = normalizeIntent(question);
  // Preserve explicit storage units and decimal punctuation for this recognizer.
  const userSuppliedContext = [
    ...history.filter((turn) => turn.role === 'user').map((turn) => turn.text),
    question,
  ].join(' ').normalize('NFKC').toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е').replace(/\s+/gu, ' ').trim();
  const suppliedInputStorageDecision = EXPLICIT_STORAGE_RATE_PATTERN.test(userSuppliedContext)
    && SUPPLIED_INPUT_DECISION_NOW_PATTERN.test(normalized);
  SUPPLIED_INPUT_DECISION_NOW_PATTERN.lastIndex = 0;
  const evidenceQuestion = suppliedInputStorageDecision
    ? normalized.replace(SUPPLIED_INPUT_DECISION_NOW_PATTERN, ' ').replace(/\s+/gu, ' ').trim()
    : normalized;
  SUPPLIED_INPUT_DECISION_NOW_PATTERN.lastIndex = 0;
  return CURRENT_EVIDENCE_PATTERNS.some((pattern) => pattern.test(evidenceQuestion));
}

function containsSensitiveInput(question: string, history: readonly HistoryTurn[]): boolean {
  const wire = [question, ...history.map((turn) => turn.text)].join('\n');
  return SENSITIVE_INPUT_PATTERNS.some((pattern) => pattern.test(wire));
}

function resolveLocale(grounding: PublicKnowledgeAnswer, requested: PublicLocale): PublicLocale {
  const detected = grounding.understanding?.detectedLocale;
  return detected === 'en' || detected === 'zh' ? detected : requested;
}

function modelUnavailableCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'The agricultural AI did not finish the answer. Retry the request.';
  if (locale === 'zh') return '农业人工智能未能完成回答。请重试该问题。';
  return 'ИИ для сельского хозяйства не завершил ответ. Повтори запрос.';
}

function sensitiveInputCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'Do not send passwords, API keys, tokens, banking credentials or personal data in this public chat. Remove the sensitive value and ask the question again.';
  if (locale === 'zh') return '请勿在公共聊天中发送密码、API 密钥、令牌、银行凭据或个人数据。删除敏感值后重新提问。';
  return 'Не отправляй в публичный чат пароли, API-ключи, токены, банковские реквизиты и персональные данные. Удали секретное значение и задай вопрос повторно.';
}

function unrelatedTopicCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'I specialize in agriculture and agribusiness. I can help with crops, machinery, farm accounting or grain sales. What would you like to work on?';
  if (locale === 'zh') return '我专注于农业和农业经营，可以帮助处理作物、农机、农场会计或粮食销售问题。你想解决哪项工作？';
  return 'Моя специализация — сельское хозяйство и агробизнес. Помогу с посевами, техникой, бухгалтерией хозяйства или продажей зерна. Какую задачу разберём?';
}

function greetingCopy(locale: PublicLocale, question: string): string {
  if (/^(?:спасибо|благодарю|thanks?|thank\s+you|谢谢)[!.?！。？\s]*$/iu.test(question.trim())) {
    if (locale === 'en') return 'You’re welcome! I can help with your next agricultural or farm-business question.';
    if (locale === 'zh') return '不客气！还可以帮你解答农业和农业经营问题。';
    return 'Пожалуйста! Помогу и со следующей задачей по хозяйству или агробизнесу.';
  }
  if (locale === 'en') return 'Hello! I’m Gekta, your agriculture and agribusiness assistant. What can I help you with?';
  if (locale === 'zh') return '你好！我是 Gekta，农业和农业经营助手。你想解决什么问题？';
  return 'Привет! Я Гекта — помощник по сельскому хозяйству и агробизнесу. С какой задачей помочь?';
}

function safetyBoundaryCopy(locale: PublicLocale, reason: AssistantSafetyReason | null): string {
  if (reason === 'HARMFUL_REQUEST') {
    if (locale === 'en') return 'I cannot help harm people, forge documents or conceal income from tax authorities. I can help with safe farm operations, accurate documents or lawful tax planning.';
    if (locale === 'zh') return '我不能协助伤害他人、伪造文件或向税务机关隐瞒收入。可以帮助规划安全的农业操作、真实文件或合法税务安排。';
    return 'Не могу помогать причинять вред людям, подделывать документы или скрывать доходы от налоговой. Помогу с безопасной работой хозяйства, достоверными документами или законным налоговым планированием.';
  }
  if (locale === 'en') return 'I cannot help bypass protection, access another party’s data, escalate privileges or perform an unauthorized action. I can explain the authorized process, safe diagnostics or the requirements for approved access.';
  if (locale === 'zh') return '我不能协助绕过保护、访问他方数据、提升权限或执行未经授权的操作。我可以说明合规流程、安全诊断方法或获得授权访问所需的条件。';
  return 'Не могу помогать обходить защиту, получать чужие данные, повышать права или выполнять действие без полномочий. Могу объяснить штатный порядок, безопасную диагностику или требования к разрешённому доступу.';
}

function normalizeIntent(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}\s«»"'-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function rebuildRequestWithoutStream(request: NextRequest, rawBody: string, omitDocuments = false): NextRequest {
  const url = new URL(request.url);
  url.searchParams.delete('stream');
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  let body = rawBody;
  if (omitDocuments) {
    // This branch follows successful envelope parsing. Untrusted attachments
    // belong only in the model payload, outside the bounded public lookup.
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    delete payload.documents;
    body = JSON.stringify(payload);
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');
  }
  return new NextRequest(url, { method: 'POST', headers, body });
}


function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
