import type { GektaLocale } from './content';
import { ARITHMETIC_NUMBER, ARITHMETIC_SCALE, arithmeticDecimal, parseSuppliedNumber } from './supplied-decimal';

type Calculation = {
  operation: 'metric_yield' | 'seed_mass' | 'net_weight' | 'offer_netback';
  answer: string;
};

type Input = { start: number; end: number; value: bigint | null; unit?: string };

const amount = '(?<![\\p{N}.,+−-])(?<number>'+ARITHMETIC_NUMBER+')';
const stop = '(?![a-zа-яё0-9/])';
const separators = '\\s*(?:[=:：—–]\\s*)?';
const hectares = '(?:га|гектар(?:а|ов)?|ha|hectares?|公顷)';
const tonnes = '(?:тонн(?:а|ы|у|ах)?|т|tonnes?|t|吨)';
const kilos = '(?:кг|килограмм(?:а|ов)?|kg|kilograms?|千克|公斤)';
const currency = '(?:₽|RUB|руб(?:лей|ля|ль)?\\.?|卢布)';
const basisWord = '(?<![a-z0-9])(?:EXW|CPT)(?![a-z0-9])';
const scale2 = ARITHMETIC_SCALE * ARITHMETIC_SCALE;
const kiloToTonne = BigInt(1000);
const zero = BigInt(0);

function find(text: string, pattern: string): Input[] {
  return [...text.matchAll(new RegExp(pattern, 'giu'))].map(match => ({
    start: match.index, end: match.index + match[0].length,
    value: parseSuppliedNumber(match.groups!.number), unit: match.groups!.unit,
  }));
}

function unassignedDigits(text: string, inputs: readonly Input[]): boolean {
  const ordered = [...inputs].sort((left, right) => left.start - right.start);
  let cursor = 0;
  for (const item of ordered) {
    if (item.start < cursor || /\p{N}/u.test(text.slice(cursor, item.start))) return true;
    cursor = item.end;
  }
  return /\p{N}/u.test(text.slice(cursor));
}

function translate(locale: GektaLocale, ru: string, en: string, zh: string): string {
  return locale === 'ru' ? ru : locale === 'en' ? en : zh;
}

function ratio(numerator: bigint, denominator: bigint, locale: GektaLocale, decimals: number): string {
  const represented = numerator * BigInt(10) ** BigInt(decimals);
  return (represented % denominator === zero ? '= ' : '≈ ') + arithmeticDecimal(numerator, denominator, locale, decimals);
}

function requestedPrecision(text: string, defaults: number): number {
  const explicit = /(?:до\s+|точность\s+до\s+)(десятых|сотых|тысячных)/iu.exec(text);
  const fixed = explicit?.[1].toLowerCase();
  return fixed === 'десятых' ? 1 : fixed === 'сотых' ? 2 : fixed === 'тысячных' ? 3 : defaults;
}

const OUTPUT_TONNES = /тонн|(?:^|[\s,:])т(?=[\s,.:?!]|$)|\bmetric tonnes?\b|\btonnes?\b|吨(?:数|种子|[？。，])|多少吨|总重量吨数/iu;
const TONNES_PER_AREA = new RegExp(tonnes+'\\s*(?:/\\s*(?:га|ha|公顷)|на\\s+гектар|per\\s+hectare)|每公顷\\s*(?:多少)?吨', 'iu');
const CALCULATION_QUESTION = /сколько|посчитай|вычисли|пересчитай|рассчитай|како[йе]|какая|общая масса|назови объ[её]м|выведи|проверь потребность|дай|переведи|what|how many|calculate|give|total harvest weight|多少|请算|求|比较/iu;
const SUPPLIED_ONLY_CONSTRAINTS = /(?:не\s+более|не\s+менее|не\s+знаю\s+сколько|до\s+вычета|с\s+уч[её]том|учитывая|добавь|вычти|прибавь|минус\s+\d|убавь|умножь|скидк|потер[яьи]|налог|НДС|стоимост|₽|плюс\s+\d|with\s+(?:loss|buffer|tax)|include\s+(?:loss|buffer|tax)|discount|cost|subtract|扣除|加上|损耗|含税)/iu;

function massFromArea(text: string, locale: GektaLocale): Calculation | null {
  if (!OUTPUT_TONNES.test(text) || !CALCULATION_QUESTION.test(text) || SUPPLIED_ONLY_CONSTRAINTS.test(text)
    || TONNES_PER_AREA.test(text)
    || /(?:с запасом|с резервом|добавь запас|add (?:a )?buffer|(?<!不要|不用|无需)加(?:备用|余量))/iu.test(text)) return null;
  const quintals = [
    ...find(text, amount+'\\s*(?:ц\\s*/\\s*га|центнер[а-яё]*\\s+(?:с|на)\\s+гектар[а-яё]*|metric quintals?\\s*(?:/\\s*ha|per hectare)|公担\\s*/\\s*公顷)'+stop),
    ...find(text, '每公顷\\s*'+amount+'\\s*公担'+stop),
  ];
  const isSeed = /сем[ея]|посев|сею|высев|seed|seeding|播种|种子|用种|计划播/iu.test(text);
  if (quintals.length && isSeed) return null;
  if (!quintals.length && !isSeed) return null;

  const area = find(text, amount+'\\s*'+hectares+stop);
  const rate = isSeed
    ? [
        ...find(text, amount+'\\s*(?:кг|kg)(?:\\s+семян)?\\s*(?:/\\s*(?:га|ha)|на\\s+гектар|per\\s+hectare)'+stop),
        ...find(text, '每公顷(?:用种|需种)?\\s*'+amount+'\\s*(?:公斤|千克)'+stop),
      ]
    : quintals;
  const operation = isSeed ? 'seed_mass' : 'metric_yield';
  if ([...rate, ...area].some(item => item.value === null)) return null;
  if (rate.length !== 1) {
    return { operation, answer: isSeed
      ? translate(locale,'Уточни норму высева в кг/га.','Please provide one seeding rate in kg/ha.','请确认一项每公顷用种量。')
      : translate(locale,'Уточни одну урожайность в ц/га.','Please confirm one yield in metric quintals per hectare.','请确认一项每公顷公担产量。') };
  }
  if (area.length !== 1) {
    return { operation, answer: isSeed
      ? translate(locale,'Уточни площадь посева в гектарах.','Please provide one planting area in hectares.','请确认一项播种面积。')
      : translate(locale,'Уточни уборочную площадь в гектарах.','Please provide one harvested area in hectares.','请确认一项实收面积。') };
  }
  if (unassignedDigits(text, [rate[0], area[0]])) return null;
  const divisor = isSeed ? kiloToTonne : BigInt(10);
  const rateUnit = isSeed ? translate(locale,'кг/га','kg/ha','千克/公顷')
    : translate(locale,'ц/га','metric quintals/ha','公担/公顷');
  const areaUnit = translate(locale,'га','ha','公顷');
  const massUnit = translate(locale,'т','t','吨');
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  return { operation, answer: `${show(rate[0].value!)} ${rateUnit} × ${show(area[0].value!)} ${areaUnit} ÷ ${divisor} ${ratio(
    rate[0].value! * area[0].value!, scale2 * divisor, locale, requestedPrecision(text, isSeed ? 3 : 2),
  )} ${massUnit}.` };
}

const WEIGH_GROSS = '(?:брутто|gross(?:\\s+(?:mass|weight))?(?:\\s+of)?|毛重)';
const WEIGH_TARE = '(?:тар[аеиуы]|tare(?:\\s+of)?|皮重)';

function netWeight(text: string, locale: GektaLocale): Calculation | null {
  if (!OUTPUT_TONNES.test(text) || SUPPLIED_ONLY_CONSTRAINTS.test(text)
    || !/(?:нетто|чистых тонн|массу груза|\bnet (?:weight|tonnes?)\b|净重)/iu.test(text)
    || !new RegExp(WEIGH_GROSS+'|'+WEIGH_TARE,'iu').test(text)) return null;
  const weighed = (label: string) => find(text, label+separators+amount+'\\s*(?<unit>'+kilos+'|'+tonnes+')'+stop);
  const gross = weighed(WEIGH_GROSS);
  const tare = weighed(WEIGH_TARE);
  const operation = 'net_weight';
  if (gross.length !== 1 || gross[0].value === null) {
    return { operation, answer: translate(locale,'Уточни массу брутто и её единицу.','Please confirm the gross weight and its unit.','请确认毛重和单位。') };
  }
  if (tare.length !== 1 || tare[0].value === null) {
    return { operation, answer: translate(locale,'Уточни массу тары и её единицу.','Please confirm the tare weight and its unit.','请确认皮重和单位。') };
  }
  if (unassignedDigits(text,[gross[0],tare[0]])) return null;
  const asKg = (item: Input) => item.value! * (new RegExp('^'+kilos+'$','iu').test(item.unit ?? '') ? BigInt(1) : kiloToTonne);
  const grossKg = asKg(gross[0]), tareKg = asKg(tare[0]);
  if (grossKg < tareKg) {
    return { operation, answer: translate(locale,'Брутто меньше тары. Сверь показания и единицы весового талона.',
      'The gross weight is less than the tare. Check the weights and units on the ticket.','毛重小于皮重，请核对地磅读数和单位。') };
  }
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const kg = translate(locale,'кг','kg','千克'), t = translate(locale,'т','t','吨');
  return { operation, answer: `(${show(grossKg)} − ${show(tareKg)}) ${kg} ÷ 1000 ${ratio(
    grossKg - tareKg, scale2, locale, requestedPrecision(text, 3),
  )} ${t}.` };
}

type Basis = 'EXW' | 'CPT';
const SELLER = /продав(?:ец|ца)|seller|卖方/iu;
const COST = /расход|затрат|достав|перевоз|транспорт|погруз|анализ|лаборатор|оплачив|стоимост|freight|cost|charge|loading|lab\b|运费|卖方费|装卸|费用/iu;
const EXPLICIT_MISMATCH = /(?:ндс|налог|срок(?:и)? оплаты|качество|отсрочк)[^.!?。！？]{0,35}(?:различ|разн|отлич|не совпад)|(?:vat|tax|quality|payment)[^.!?。！？]{0,25}(?:differ|unequal)|(?:税|质量|付款)[^。！？]{0,18}(?:不同|不一致)/iu;
const INCOMPLETE_COST = /(?:неизвест|не знаю|не указан|не уточн|непонятно|не определ[её]н|not know|unknown|unspecified|未明确|未知)/iu;
const COST_BEARER_UNCLEAR = /за сч[её]т покупателя|покупатель\s+(?:платит|оплачивает|нес[её]т)|buyer\s+pays|买方承担/iu;
const COST_ALREADY_INCLUDED = /(?:уже\s+(?:вычтен|учт[её]н|включ[её]н)|(?:после|сразу\s+после)\s+вычета\s+расходов|в том числе|already\s+(?:net|deducted|included)|net\s+of\s+freight|已扣除|已包含|其中)/iu;

function sameSentenceBefore(text: string, end: number): string {
  const prefix = text.slice(0, end);
  const sentences = prefix.split(/[?!。！？；;]|\.(?!\d)/gu);
  return sentences.at(-1) ?? '';
}

function offerNetback(text: string, locale: GektaLocale): Calculation | null {
  if (!/\bEXW\b/iu.test(text) || !/\bCPT\b/iu.test(text)
    || !/сравн|выгод|лучш|преимуществ|больше|разниц|compare|better|difference|offers more|比较|差额|更高/iu.test(text)
    || /USD|EUR|доллар|евро|[$€]|用美元|多种报价/iu.test(text)) return null;
  const money = find(text, amount+'\\s*'+currency+'(?:\\s*/\\s*(?<unit>'+tonnes+'))?'+stop);
  const offers = new Map<Basis, bigint>();
  const costs: { basis: Basis; value: bigint; total: boolean }[] = [];
  let lastEnd = 0;
  let unresolvedAmount = false;
  for (const fact of money) {
    const before = sameSentenceBefore(text,fact.start);
    const sincePrevious = text.slice(lastEnd,fact.start);
    const after = text.slice(fact.end);
    lastEnd = fact.end;
    const nearestBasis = [...before.matchAll(new RegExp(basisWord,'giu'))].at(-1)?.[0].toUpperCase() as Basis | undefined;
    const perTonne = Boolean(fact.unit) || /每吨\s*$/u.test(before);
    if (fact.value === null) { unresolvedAmount = true; continue; }
    if (COST.test(sincePrevious) && SELLER.test(before) && nearestBasis) {
      const total = /^\s*(?:за\s+(?:всю\s+)?партию|for\s+(?:the\s+)?(?:whole\s+)?lot|整批合计|合计)/iu.test(after);
      if (perTonne === total) unresolvedAmount = true;
      else costs.push({ basis: nearestBasis, value: fact.value, total });
      continue;
    }
    const leading = /(?<![a-z\d])(EXW|CPT)(?:\s*(?:за|по цене|at|每吨))?\s*(?:[:=—–]\s*)?$/iu.exec(before)?.[1];
    const trailing = /^\s*(EXW|CPT)(?![a-z0-9])/iu.exec(after)?.[1];
    const label = (leading ?? trailing)?.toUpperCase() as Basis | undefined;
    if (!label || !perTonne || offers.has(label)
      || (leading && trailing && leading.toUpperCase() !== trailing.toUpperCase())) unresolvedAmount = true;
    else offers.set(label,fact.value);
  }
  if (offers.size !== 2) return null;
  const operation = 'offer_netback';
  if (EXPLICIT_MISMATCH.test(text)) {
    return { operation, answer: translate(locale,'Приведи цены к единому НДС и сопоставь сроки оплаты и качество. После этого сравним чистые суммы.',
      'Normalize the VAT, payment dates and quality terms before comparing net proceeds.','先统一税费、付款日期和质量条件，再比较净收入。') };
  }
  if (COST_ALREADY_INCLUDED.test(text)) {
    return { operation, answer: translate(locale,'Уточни, из какой цены уже вычтены расходы продавца. Для сравнения нужны либо две цены до вычета с расходами по каждой, либо две чистые цены.',
      'Confirm which price is already net of seller costs. To compare, use two gross prices with their costs or two net prices.',
      '请确认哪个报价已扣除卖方费用。比较时请提供两个净价，或两个扣费前报价及各自费用。') };
  }
  if (!costs.some(cost => cost.basis === 'CPT') || unresolvedAmount || INCOMPLETE_COST.test(text) || COST_BEARER_UNCLEAR.test(text)) {
    return { operation, answer: translate(locale,'Уточни расходы продавца при CPT и какие расходы есть при EXW. Укажи, что дано за тонну, а что за партию.',
      'Confirm which costs the seller pays under CPT and EXW, with units for per-tonne and whole-lot charges.','请确认 CPT 与 EXW 下卖方承担的费用，以及按吨还是按整批计费。') };
  }
  const weights = find(text, amount+'\\s*'+tonnes+stop);
  if (weights.length !== 1 || weights[0].value === null || weights[0].value <= zero) {
    return { operation, answer: translate(locale,'Уточни массу партии в тоннах, чтобы посчитать разницу для всей партии.',
      'Please confirm the lot mass in tonnes to compute the total difference.','请确认整批吨数，以计算整批差额。') };
  }
  if (unassignedDigits(text, [...money, ...weights])) return null;
  const mass = weights[0].value;
  const net = (basis: Basis) => costs.filter(cost => cost.basis === basis)
    .reduce((total,cost) => total - cost.value * (cost.total ? ARITHMETIC_SCALE : mass), offers.get(basis)! * mass);
  const netExw = net('EXW');
  const netCpt = net('CPT');
  const delta = netCpt - netExw;
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const perTonne = (value: bigint) => {
    const denominator = ARITHMETIC_SCALE * mass;
    return value * BigInt(100) % denominator === zero ? arithmeticDecimal(value, denominator, locale)
      : `≈ ${arithmeticDecimal(value, denominator, locale, 2)}`;
  };
  const rub = translate(locale,'₽','RUB','卢布'), t = translate(locale,'т','t','吨');
  const winner = delta > zero ? 'CPT' : 'EXW';
  const absoluteDelta = delta < zero ? -delta : delta;
  const difference = arithmeticDecimal(absoluteDelta, scale2, locale);
  const perTonneDifference = perTonne(absoluteDelta);
  const basis = translate(locale,'Расчёт учитывает указанные расходы продавца и предполагает одинаковые НДС, качество и сроки оплаты.',
    'The calculation uses the stated seller costs and assumes identical VAT, quality and payment terms.','计算以所列卖方费用及相同的税费、质量和付款条件为准。');
  const netPrices = `EXW ${perTonne(netExw)} ${rub}/${t}, CPT ${perTonne(netCpt)} ${rub}/${t}`;
  const totalPrices = `EXW ${arithmeticDecimal(netExw, scale2, locale)} ${rub}, CPT ${arithmeticDecimal(netCpt, scale2, locale)} ${rub}`;
  const lotTotal = translate(locale,`Чистые суммы за ${show(mass)} ${t} — ${totalPrices}.`,
    `For the ${show(mass)} ${t} lot, net proceeds are ${totalPrices}.`, `${show(mass)} ${t} 整批净收入为 ${totalPrices}。`);
  const result = delta === zero ? translate(locale,'Чистые суммы равны.','The net proceeds are equal.','净收入相同。')
    : translate(locale,`Чистая сумма выше у ${winner}. Разница ${perTonneDifference} ${rub}/${t}. Разница за партию ${difference} ${rub}.`,
      `Net proceeds are higher for ${winner}. Difference ${perTonneDifference} ${rub}/${t}. Difference for the lot ${difference} ${rub}.`,
      `${winner} 净收入更高。吨价差 ${perTonneDifference} ${rub}/${t}。整批差额 ${difference} ${rub}。`);
  return { operation, answer: `${basis} ${netPrices}. ${result} ${lotTotal}` };
}

/** Bind units and their roles without depending on the question's word order. */
export function calculateFromAgroInputs(question: string, locale: GektaLocale): Calculation | null {
  const text = question.normalize('NFKC').trim().replace(/\s+/gu,' ');
  return offerNetback(text,locale) ?? netWeight(text,locale) ?? massFromArea(text,locale);
}
