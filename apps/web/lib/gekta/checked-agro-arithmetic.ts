import type { GektaLocale } from './content';
import { ARITHMETIC_SCALE, arithmeticDecimal, compileSuppliedForm, parseSuppliedNumber } from './supplied-decimal';

const forms = {
  cost_allocation: [
    'Учёт затрат @ref, @crop. Всего @cost ₽, уборочная площадь @area га, валовой сбор @mass т. Найди затраты на тонну и гектар с округлением до копеек.',
    'Расходы @cost ₽, площадь @area га и урожай @mass т. Сколько рублей на тонну и на гектар?',
    'Farm cost sheet @ref for @crop: RUB @cost total, @area ha and output @mass t. Give RUB per tonne and per hectare to two decimals.',
    '@crop成本表@ref：总支出@cost卢布，面积@area公顷，产量@mass吨。分别求每吨和每公顷成本，保留两位。',
  ],
  payment_present_value: [
    'Учебная сделка @ref: за @crop сегодня платят @now ₽/т или @future ₽/т через @days дней. Простая ставка @rate% годовых, год @baseDays дней, риск и прочие условия одинаковы. Посчитай эквивалент отсроченной оферты сегодня и минимальную будущую цену для равенства, до копеек.',
    'Training lot @ref, @crop: @now RUB/t now or @future RUB/t in @days days. Simple annual discount rate @rate%, @baseDays-day year, all else equal. Compute today’s value of the delayed quote and the future break-even offer to two decimals.',
    '练习交易@ref：@crop现付每吨@now卢布，@days天后付款的报价每吨@future卢布。采用年单利@rate%，一年@baseDays天，风险等其他条件相同。计算延迟报价现值及与现价相当的未来报价，保留两位。',
  ],
  drying_mass: [
    'У партии @ref (@crop) масса @mass т, влажность @initial%. После сушки влажность @final%. Сухое вещество неизменно, иных потерь нет. Какова новая масса в тоннах до сотых?',
    'Было @mass т при влажности @initial%. После сушки влажность @final%, сухое вещество неизменно. Сколько тонн останется?',
    'Lot @ref, @mass t of @crop at @initial% wet-basis moisture, is dried to @final%. Dry matter remains unchanged. What mass in tonnes remains to 2 decimals?',
    '@ref批@crop质量@mass吨，湿基含水率由@initial%降到@final%。假设干物质质量不变。求干燥后总吨数，保留两位。',
  ],
  weighted_price: [
    'По учётной ведомости @ref первого лота @crop — @massA т по @priceA ₽/т, второго — @massB т по @priceB ₽/т. Базис и оплата совпадают. Дай совокупную стоимость и цену, взвешенную по тоннам (до 0,01 ₽/т).',
    'Есть @massA т по @priceA ₽/т и @massB т по @priceB ₽/т на одинаковых условиях. Посчитай общую стоимость и средневзвешенную цену.',
    'Ledger @ref: @massA t of @crop at @priceA RUB/t and @massB t at @priceB RUB/t, same terms. Give the combined value and volume-weighted RUB/t to two decimals.',
    '台账@ref有两批@crop，@massA吨每吨@priceA卢布及@massB吨每吨@priceB卢布，交易条件相同。求总货值和按吨数加权的每吨单价，单价保留两位。',
    '有两批待售@crop。一批@massA吨，每吨@priceA卢布。另一批@massB吨，每吨@priceB卢布。付款与运输条件相同。计算总货值和以吨数加权的每吨平均价，平均价保留到两位小数。',
  ],
  weighted_moisture: [
    'Аналитическая карточка @ref. У @massA т (@crop) влажность @rateA%, у @massB т — @rateB%. Требуется расчётная средневзвешенная влажность по влажной массе до 0,01 п.п. Смешивание и приёмку не обсуждай.',
    'При влажной массе @massA т влажность @rateA%, при влажной массе @massB т влажность @rateB%. Посчитай средневзвешенную влажность по массе.',
    'Analysis @ref: @massA t of @crop at @rateA% moisture and @massB t at @rateB%. Find the wet-mass weighted mean to two decimals, for this calculation only.',
    '@ref两批@crop分别是@massA吨含水率@rateA%、@massB吨含水率@rateB%。仅计算按湿质量加权的平均含水率，保留两位。',
  ],
  mass_loss: [
    'Протокол @ref: первоначальная масса @crop @mass т. При сортировке потери @rate% от этой массы. Найди потери и остаток в тоннах до сотых.',
    'Масса до сортировки @mass т, потери @rate% от исходной массы. Сколько тонн потеряли и сколько осталось?',
    'Protocol @ref: @mass t of @crop before sorting. Loss is @rate% of initial mass. Give the loss and the remainder in tonnes to two decimals.',
    '@ref记录中@crop初始质量为@mass吨，分选损耗为初始质量的@rate%。求损失吨数和剩余吨数，保留两位。',
  ],
  storage_break_even: [
    'План продажи @ref (@crop). Сегодня дают @now ₽/т. Ожидание @days дней стоит @rate ₽/т в день, выгрузка после хранения ещё @unload ₽/т. Проценты и потери принять нулевыми. Какая поздняя цена даст столько же средств на тонну?',
    'Sale plan @ref, @crop: @now RUB/t now. Waiting @days days costs @rate RUB/t/day and an extra @unload RUB/t for unloading. Assume no financing or mass loss. What future price per tonne breaks even?',
    '@ref销售计划：@crop今日@now卢布/吨。储存@days天，每吨每天@rate卢布，另有卸货费@unload卢布/吨。不计利息或损耗。未来每吨售价达到多少才能与今天等值？',
  ],
  net_weight: [
    'Рейс @ref, @crop. Весовая записала брутто @gross кг, тара @tare кг. Какая масса нетто в тоннах? Выведи три знака после запятой.',
    'Брутто @gross кг, тара @tare кг. Сколько тонн нетто?',
    'Truck @ref, @crop: scale gross @gross kg and tare @tare kg. Calculate net metric tonnes to three decimals.',
    '@ref车辆载运@crop，地磅毛重@gross千克、皮重@tare千克。求净重吨数，保留三位。',
  ],
  shipment_fulfillment: [
    'График отгрузки @ref, @crop: согласовано @mass т. Покупатель уже принял @massA т и @massB т по двум актам. Определи остаток в тоннах и долю выполнения до 0,01%.',
    'По договору @mass т. Приняли @massA т и @massB т. Сколько осталось и какой процент выполнен?',
    'Shipping schedule @ref, @crop: @mass t agreed. Two acceptance notes for @massA t and @massB t. Calculate tonnes outstanding and percentage fulfilled to two decimals.',
    '@ref运输计划：合同@crop共@mass吨，已验收两次@massA吨与@massB吨。求剩余吨数和履行比例（百分比保留两位）。',
  ],
  electricity_cost: [
    'Сушилка @ref, @crop. Потрачено @energy кВт·ч за @rate ₽/кВт·ч. За этот цикл из сушилки вышло @mass т. Сколько стоила электроэнергия всего и на тонну выхода? До копеек.',
    'Dryer @ref, @crop: @energy kWh at @rate RUB/kWh, finished output @mass t. Total electricity cost and cost per tonne of output to two decimals?',
    '@ref干燥@crop耗电@energy千瓦时，电价每千瓦时@rate卢布，干燥后出料@mass吨。电费合计和每吨出料电费分别是多少？保留两位。',
  ],
  price_change: [
    'В учебном ряду @ref цена на @crop с теми же условиями в @year изменилась с @initial до @final ₽/т. Дай изменение в ₽/т и процентах от первой цены, со знаком и округлением процентов до сотых.',
    'Цена изменилась с @initial до @final ₽/т на одинаковых условиях. Какова разница в рублях на тонну и процентах от первой цены?',
    'Training series @ref, same @crop terms in @year: @initial to @final RUB/t. Give signed absolute and percent changes relative to the initial price, with percent to two decimals.',
    '@ref练习数据：@year年相同条件下@crop价格从每吨@initial变为@final卢布。给出每吨绝对差和相对原价的百分比变化，保留正负号和两位小数。',
  ],
  funding_gap: [
    'Календарь @ref, @crop: закупаю @mass т по @buy ₽/т с оплатой сегодня. Продажа по @sell ₽/т, покупатель сегодня даёт @rate% от всей суммы. Остаток позже. Других поступлений и платежей нет. Сколько рублей предоплата и сколько не хватает для оплаты закупки сегодня?',
    'Cashflow @ref, @crop: pay for @mass t at @buy RUB/t today. Resale is @sell RUB/t, buyer prepays @rate% of the full resale amount today and pays the rest later. Find the prepayment and today’s funding gap.',
    '@ref现金安排：今日按每吨@buy卢布购入@mass吨@crop；卖价每吨@sell卢布，购买方今天预付全部销售额的@rate%，余额以后付。求今天预收款及采购资金缺口。',
  ],
  supplied_currency_rate: [
    'В условном инвойсе @ref (@crop) цена @price USD за тонну. В задаче использовать курс @exchangeRate ₽ за доллар. Дай цену в рублях за тонну и за @mass т до копеек.',
    'Fictional invoice @ref, @crop: @price USD/t at the supplied rate @exchangeRate RUB per USD. Compute RUB/t and total RUB for @mass t to two decimals. Do not use an outside rate.',
    '练习发票@ref：@crop报价@price美元/吨，题设汇率每美元@exchangeRate卢布。求卢布每吨和@mass吨总值，保留两位。',
  ],
  break_even_volume: [
    'План @ref по @crop. Постоянные расходы @cost ₽. После всех переменных расходов остаётся @benefit ₽ на тонну для покрытия постоянных. Какой минимальный целый объём продаж покрывает расходы?',
    'Постоянные затраты @cost ₽, вклад после переменных затрат @benefit ₽/т. Сколько целых тонн нужно продать для безубыточности?',
    'Plan @ref, @crop: fixed cost @cost RUB, contribution after variable costs @benefit RUB per tonne. What minimum whole number of tonnes covers fixed cost?',
    '@ref的@crop计划：固定成本@cost卢布，扣除变动成本后每售一吨贡献@benefit卢布。覆盖固定成本所需的最小整吨销量是多少？',
  ],
  field_loss_sample: [
    'Замер @ref: за комбайном найдено @mass г зерна на @area м² (@crop). Пересчитай эту массу в кг/га до сотых. Что ещё нужно измерить, чтобы отделить потери техники от естественного осыпания?',
    'Sample @ref behind a combine: @mass g of @crop over @area m². Convert to kg/ha to 2 decimals. What else distinguishes pre-harvest loss from machine losses?',
    '@ref在收割机后@area平方米捡到@crop@mass克，换算成公斤/公顷（两位小数）。若区分自然落粒和机器损失，还要测什么？',
  ],
  feed_dry_matter: [
    'Учётная кормовая проба @ref. Взвесили @mass кг сырого корма, доля сухого вещества @rate%. Рассчитай кг сухого вещества до сотых. Кормовую норму не назначай.',
    'Проба корма @mass кг, сухого вещества @rate%. Сколько килограммов сухого вещества?',
    'Feed ledger sample @ref: @mass kg as fed at @rate% dry matter. Calculate dry matter kg to 2 decimals for the ledger only.',
    '饲料样本@ref鲜重@mass千克，干物质@rate%。只计算干物质千克，保留两位。',
  ],
} as const;

export type CheckedAgroOperation = keyof typeof forms;

const checkedForms = (Object.keys(forms) as CheckedAgroOperation[]).flatMap(operation =>
  forms[operation].map(form => ({ operation, pattern: compileSuppliedForm(form) })),
);

const ZERO = BigInt(0);
const SCALE_SQUARED = ARITHMETIC_SCALE * ARITHMETIC_SCALE;
const HUNDRED = BigInt(100);
const PERCENT_BASE = HUNDRED * ARITHMETIC_SCALE;

function calculate(operation: CheckedAgroOperation, inputs: Readonly<Record<string, bigint>>, locale: GektaLocale): string {
  const { mass, massA, massB, area, initial, final, cost, now, future, days, baseDays,
    rate, rateA, rateB, priceA, priceB, unload, gross, tare, energy, buy, sell, price, exchangeRate, benefit } = inputs;
  const pick = (ru: string, en: string, zh: string) => locale === 'en' ? en : locale === 'zh' ? zh : ru;
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const estimate = (numerator: bigint, denominator: bigint, decimals = 2) => {
    const sign = numerator * BigInt(10) ** BigInt(decimals) % denominator === ZERO ? '=' : '≈';
    return `${sign} ${arithmeticDecimal(numerator, denominator, locale, decimals)}`;
  };
  const currency = pick('₽', 'RUB', '卢布');
  const tonne = pick('т', 't', '吨');
  const priceUnit = `${currency}/${tonne}`;
  const hectare = pick('га', 'ha', '公顷');
  const kilogram = pick('кг', 'kg', '千克');
  const inconsistent = pick(
    'С указанными данными этот расчёт не определён. Проверь исходные значения.',
    'The calculation is undefined with these values. Check the supplied inputs.',
    '按这些数值无法计算，请核对给定数据。',
  );

  switch (operation) {
    case 'cost_allocation':
      if (mass === ZERO || area === ZERO) return inconsistent;
      return `${show(cost)} ÷ ${show(mass)} ${estimate(cost, mass)} ${priceUnit}.\n${show(cost)} ÷ ${show(area)} ${estimate(cost, area)} ${currency}/${hectare}.`;
    case 'payment_present_value': {
      if (baseDays === ZERO) return inconsistent;
      const base = PERCENT_BASE * baseDays;
      const factor = base + rate * days;
      const term = `(1 + ${show(rate)}% × ${show(days)} ÷ ${show(baseDays)})`;
      return `${pick('Эквивалент сегодня', 'Present value', '现值')} — ${show(future)} ÷ ${term} ${estimate(future * base, factor * ARITHMETIC_SCALE)} ${priceUnit}.\n${pick('Цена для равенства при отсрочке', 'Break-even delayed price', '等值的延期价格')} — ${show(now)} × ${term} ${estimate(now * factor, base * ARITHMETIC_SCALE)} ${priceUnit}.`;
    }
    case 'drying_mass':
      if (initial >= PERCENT_BASE || final > initial) return inconsistent;
      return `${pick('При влажности по общей массе и сохранении сухого вещества', 'With wet-basis moisture and unchanged dry matter', '按湿基含水率和干物质不变计算')} — ${show(mass)} × (100 − ${show(initial)}) ÷ (100 − ${show(final)}) ${estimate(mass * (PERCENT_BASE - initial), ARITHMETIC_SCALE * (PERCENT_BASE - final))} ${tonne}.`;
    case 'weighted_price':
    case 'weighted_moisture': {
      const moisture = operation === 'weighted_moisture';
      const first = moisture ? rateA : priceA;
      const second = moisture ? rateB : priceB;
      const totalMass = massA + massB;
      if (totalMass === ZERO || (moisture && (first > PERCENT_BASE || second > PERCENT_BASE))) return inconsistent;
      const numerator = massA * first + massB * second;
      const formula = `${show(massA)} × ${show(first)} + ${show(massB)} × ${show(second)}`;
      const average = estimate(numerator, ARITHMETIC_SCALE * totalMass);
      if (moisture) return `(${formula}) ÷ (${show(massA)} + ${show(massB)}) ${average}%.`;
      return `${pick('Общая стоимость', 'Combined value', '总货值')} — ${formula} ${estimate(numerator, SCALE_SQUARED)} ${currency}.\n${pick('Средневзвешенная цена', 'Weighted price', '按质量加权的单价')} — (${formula}) ÷ (${show(massA)} + ${show(massB)}) ${average} ${priceUnit}.`;
    }
    case 'mass_loss':
      if (rate > PERCENT_BASE) return inconsistent;
      return `${pick('Потери', 'Loss', '损耗')} — ${show(mass)} × ${show(rate)}% ${estimate(mass * rate, PERCENT_BASE * ARITHMETIC_SCALE)} ${tonne}.\n${pick('Остаток', 'Remainder', '剩余')} — ${show(mass)} × (100% − ${show(rate)}%) ${estimate(mass * (PERCENT_BASE - rate), PERCENT_BASE * ARITHMETIC_SCALE)} ${tonne}.`;
    case 'storage_break_even':
      return `${pick('Порог цены с указанными расходами', 'Break-even price with the stated costs', '按给定费用计算的保本价')} — ${show(now)} + ${show(days)} × ${show(rate)} + ${show(unload)} = ${arithmeticDecimal((now + unload) * ARITHMETIC_SCALE + days * rate, SCALE_SQUARED, locale)} ${priceUnit}.`;
    case 'net_weight':
      if (tare > gross) return inconsistent;
      return `(${show(gross)} − ${show(tare)}) ${kilogram} ÷ 1000 ${estimate(gross - tare, SCALE_SQUARED, 3)} ${tonne}.`;
    case 'shipment_fulfillment': {
      if (mass === ZERO) return inconsistent;
      const received = massA + massB;
      const remaining = mass - received;
      const remainder = remaining >= ZERO
        ? `${pick('Осталось', 'Outstanding', '剩余')} — ${show(mass)} − ${show(massA)} − ${show(massB)} = ${show(remaining)} ${tonne}.`
        : `${pick('Осталось 0', 'Outstanding 0', '剩余0')} ${tonne}. ${pick('Принято сверх объёма', 'Accepted in excess', '超额验收')} ${show(-remaining)} ${tonne}.`;
      return `${remainder}\n${pick('Выполнено', 'Fulfilled', '已履行')} — (${show(massA)} + ${show(massB)}) ÷ ${show(mass)} × 100% ${estimate(received * HUNDRED, mass)}%.`;
    }
    case 'electricity_cost': {
      if (mass === ZERO) return inconsistent;
      const amount = energy * rate;
      return `${show(energy)} × ${show(rate)} ${estimate(amount, SCALE_SQUARED)} ${currency}.\n(${show(energy)} × ${show(rate)}) ÷ ${show(mass)} ${estimate(amount, ARITHMETIC_SCALE * mass)} ${priceUnit}.`;
    }
    case 'price_change': {
      if (initial === ZERO) return inconsistent;
      const delta = final - initial;
      const signed = (value: bigint, denominator: bigint, decimals?: number) => {
        const text = arithmeticDecimal(value, denominator, locale, decimals);
        return value > ZERO && !/^0(?:[.,]0+)?$/u.test(text) ? `+${text}` : text;
      };
      const comparison = delta * HUNDRED * HUNDRED % initial === ZERO ? '=' : '≈';
      return `${show(final)} − ${show(initial)} = ${signed(delta, ARITHMETIC_SCALE)} ${priceUnit}.\n(${show(final)} − ${show(initial)}) ÷ ${show(initial)} × 100% ${comparison} ${signed(delta * HUNDRED, initial, 2)}%.`;
    }
    case 'funding_gap': {
      if (rate > PERCENT_BASE) return inconsistent;
      const advance = mass * sell * rate;
      const purchase = mass * buy;
      const scale = SCALE_SQUARED * PERCENT_BASE;
      const gap = purchase * PERCENT_BASE - advance;
      const balance = gap >= ZERO
        ? `${pick('Не хватает', 'Funding gap', '资金缺口')} ${arithmeticDecimal(gap, scale, locale, 2)} ${currency}.`
        : `${pick('Дефицит 0', 'Funding gap is 0', '资金缺口为0')} ${currency}. ${pick('Избыток', 'Surplus', '余额')} ${arithmeticDecimal(-gap, scale, locale, 2)} ${currency}.`;
      return `${pick('Предоплата', 'Prepayment', '预收款')} — ${show(mass)} × ${show(sell)} × ${show(rate)}% ${estimate(advance, scale)} ${currency}.\n${pick('Стоимость закупки', 'Purchase cost', '采购金额')} — ${show(mass)} × ${show(buy)} ${estimate(purchase, SCALE_SQUARED)} ${currency}. ${balance}`;
    }
    case 'supplied_currency_rate': {
      if (exchangeRate === ZERO) return inconsistent;
      const perTonne = price * exchangeRate;
      return `${pick('По курсу из вопроса', 'At the supplied exchange rate', '按题设汇率')} — ${show(price)} × ${show(exchangeRate)} ${estimate(perTonne, SCALE_SQUARED)} ${priceUnit}.\n${show(price)} × ${show(exchangeRate)} × ${show(mass)} ${estimate(perTonne * mass, SCALE_SQUARED * ARITHMETIC_SCALE)} ${currency}.`;
    }
    case 'break_even_volume': {
      if (benefit === ZERO) return cost === ZERO ? `0 ${tonne}.` : inconsistent;
      const wholeTonnes = (cost + benefit - BigInt(1)) / benefit;
      return `${pick('Минимальный целый объём', 'Minimum whole volume', '最小整数销量')} — ⌈${show(cost)} ÷ ${show(benefit)}⌉ = ${wholeTonnes} ${tonne}.`;
    }
    case 'field_loss_sample':
      if (area === ZERO) return inconsistent;
      return `${show(mass)} ÷ ${show(area)} × 10 ${estimate(mass * BigInt(10), area)} ${pick('кг/га', 'kg/ha', '公斤/公顷')}.\n${pick(
        'Это наблюдение за комбайном. Сравни сопоставимые повторные замеры до прохода и отдельно оцени вклад жатки. При отборе проб соблюдай правила безопасной остановки из руководства к комбайну.',
        'This is the observed amount behind the combine. Compare repeated comparable pre-harvest samples and measure header loss separately. Follow the combine manual’s safe-stop instructions when sampling.',
        '这是机后观测量。比较同条件下多次测量的收割前背景，并单独测量割台损失。取样时遵守收割机手册的安全停机要求。',
      )}`;
    case 'feed_dry_matter':
      if (rate > PERCENT_BASE) return inconsistent;
      return `${show(mass)} × ${show(rate)}% ${estimate(mass * rate, PERCENT_BASE * ARITHMETIC_SCALE)} ${kilogram} ${pick('сухого вещества', 'dry matter', '干物质')}.`;
  }
}

/** An entire request must supply the inputs and basis of exactly one calculation. */
export function checkedAgroArithmetic(question: string, locale: GektaLocale): { operation: CheckedAgroOperation; answer: string } | null {
  const normalized = question.trim().replace(/\s+/gu, ' ');
  for (const { operation, pattern } of checkedForms) {
    const groups = pattern.exec(normalized)?.groups;
    if (!groups) continue;
    const inputs: Record<string, bigint> = {};
    for (const [field, raw] of Object.entries(groups)) {
      const number = parseSuppliedNumber(raw, field === 'exchangeRate');
      if (number === null) return null;
      inputs[field] = number;
    }
    return { operation, answer: calculate(operation, inputs, locale) };
  }
  return null;
}
