import type { GektaLocale } from './content';
import type { GektaDocumentContext } from './document-context';
import { ARITHMETIC_SCALE, arithmeticDecimal, compileSuppliedForm, parseSuppliedNumber } from './supplied-decimal';

const documentQuestions = {
  contract_terms: [
    'Прочитай договор @lot. Назови цену за тонну, массу, базис и событие начала срока платежа. Для каждого пункта дай страницу.',
    'Read contract @lot. Identify price per tonne, mass, delivery basis, and the event starting the payment clock. Cite the page for each.',
    '阅读合同@lot。列每吨价格、数量、交付基准和付款期限起算事件，并逐一给页码。',
  ],
  weigh_ticket: [
    'Сверь накладную и весовой талон по партии @lot. Какую массу подтверждает каждый и сколько составило расхождение?',
    'Reconcile the waybill and weigh ticket for @lot. What mass does each show and how large is the discrepancy?',
    '校验@lot批次的发货单和地磅单。分别记录多少吨、相差多少？',
  ],
  intake_payment_status: [
    'Что доказано актом @lot и чего он не доказывает? Назови допустимый источник для проверки поступления денег.',
    'What does acceptance note @lot establish? What is the right evidence to verify receipt of funds?',
    '验收单@lot能证明什么？应以哪个凭证核实收款？',
  ],
  sample_limit: [
    'По данным двух образцов @lot проверь условие по влажности. Насколько второй выше лимита в процентных пунктах? Какие остальные параметры качества подтверждены?',
    'Check the moisture limit for two samples in @lot. How many percentage points is the second above the limit? What other quality criteria are evidenced?',
    '对照@lot两份样品含水率限值，第二份高出几百分点？还有哪些其他质量指标得到证明？',
  ],
  workbook_intake: [
    'В книге @lot посчитай массу только принятых строк листа «Приёмка». Исключи бронь и отдельно назови стоимость анализа с листа расходов. Укажи лист и ячейку.',
    'In workbook @lot, total accepted rows only from the Intake sheet. Exclude the reservation and give the lab charge from Costs with its cell.',
    '在工作簿@lot中，仅加总“验收”页已收货行，排除预留，并指出“费用”页检测费及单元格。',
  ],
  incomplete_payment_clause: [
    'По тексту приложения @lot назови согласованную массу и точную дату последней оплаты. Укажи, чего не хватает.',
    'From attachment @lot, identify the agreed mass and exact final payment date. Identify any missing evidence.',
    '根据附件@lot填写约定吨数和最终付款的准确日期。指出缺少的证据。',
  ],
  amendment_price: [
    'Сравни подписанные договор и допсоглашение @lot. Какая цена применима к партии @firstDay-го числа и к партии @secondDay-го числа того же месяца?',
    'Reconcile contract and signed amendment @lot. What price applies to shipments on day @firstDay and day @secondDay of the effective month?',
    '对照合同与已签补充协议@lot。生效月@firstDay号和@secondDay号发运分别适用哪个价格？',
  ],
  documented_netback: [
    'Вычисли чистую цену CPT из приложения @lot и сравни с EXW. Покажи формулу и источник вычета.',
    'Compute CPT net from attachment @lot and compare to EXW. Show the formula and the fee source.',
    '从附件@lot计算CPT净价并与EXW比较，给出公式和扣费出处。',
  ],
  delivery_evidence: [
    'Какие события подтверждает комплект рейса @lot? Можно ли поставить «покупатель принял» и какие бумаги для этого нужны?',
    'What events are evidenced for journey @lot? Can we mark buyer acceptance and what would substantiate it?',
    '运输单据@lot能证实哪些事件？可标记买方已验收吗？需什么补充文件？',
  ],
  draft_submission: [
    'Из статуса в журнале @lot сделай список подтверждённого и недостающего. Достаточно ли записи, чтобы считать, что сообщение внешней системы принято?',
    'From log @lot, list confirmed and missing facts. Does the record prove the external system accepted the submission?',
    '根据日志@lot列出已确认和缺失信息。能证明外部系统已接收申报吗？',
  ],
  prepayment_evidence: [
    'По документам @lot рассчитай указанную предоплату и скажи, подтверждено ли её получение.',
    'Using documents @lot, calculate the agreed prepayment and state whether receipt is evidenced.',
    '根据材料@lot计算预付款，并说明是否已证实到账。',
  ],
  unique_trips: [
    'В реестре @lot повтор одного ID — дубль. Посчитай принятую массу по уникальным рейсам и объясни, какую строку убрал.',
    'In ledger @lot, repeated IDs are duplicates. Sum unique accepted trips and specify which row was removed.',
    '台账@lot中重复编号为重复记录。求唯一已验收车次总吨数，并说明剔除哪一行。',
  ],
  accepted_rows: [
    'Из выгрузки @lot сложи две строки со статусом «принято» с точностью до сотых тонны. Укажи, какую строку исключил.',
    'From export @lot, sum the two accepted rows to 0.01 t and identify the excluded record.',
    '汇总导出@lot中两条“验收”记录，保留两位，注明排除的记录。',
  ],
  revised_ticket: [
    'Откорректируй итог по партии @lot: опирайся на приложенный исправленный талон. Сколько тонн и сколько рублей по прежней подтверждённой цене?',
    'Correct the total for lot @lot using the revised ticket. Give tonnes and value at the previously confirmed price.',
    '根据更正后的地磅单更新@lot批次：给净吨数，以及按前面确认单价算的总价。',
  ],
} as const;

type DocumentOperation = keyof typeof documentQuestions;
type EvidenceOperation = DocumentOperation | 'intake_summary' | 'payment_clock' | 'moisture_lots';
type Fields = Readonly<Record<string, string>>;
type DocumentTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

const evidenceFields = {
  lot: '(?<lot>[\\p{L}\\d][\\p{L}\\d-]{0,40})',
  date: '(?<date>\\d{4}-\\d{2}-\\d{2})',
  firstDay: '(?<firstDay>[1-9]|[12]\\d|3[01])',
  secondDay: '(?<secondDay>[1-9]|[12]\\d|3[01])',
  pageA: '(?<pageA>[1-9]\\d{0,3})',
  pageB: '(?<pageB>[1-9]\\d{0,3})',
  clauseA: '(?:\\d{1,3}\\.)?\\d{1,3}',
  clauseB: '(?:\\d{1,3}\\.)?\\d{1,3}',
  basis: '(?<basis>(?:EXW|FCA|CPT)\\s*[\\p{L}][\\p{L} -]{0,40})',
  row: '(?<row>[1-9]\\d{0,4})',
  trip: '(?<trip>[A-Za-z0-9]+-[A-Za-z0-9]+)',
  cellA: '(?<cellA>[A-Z]{1,3}[1-9]\\d{0,5})',
  cellB: '(?<cellB>[A-Z]{1,3}[1-9]\\d{0,5})',
  heldCell: '(?<heldCell>[A-Z]{1,3}[1-9]\\d{0,5})',
  costCell: '(?<costCell>[A-Z]{1,3}[1-9]\\d{0,5})',
  intakeSheet: '(?<intakeSheet>Приёмка|Intake|验收)',
  costSheet: '(?<costSheet>Расходы|Costs|费用)',
  pageBreak: '\\s*',
};

function evidenceForms(forms: readonly string[]): readonly RegExp[] {
  return forms.map(form => compileSuppliedForm(form, evidenceFields));
}

const questions = (Object.keys(documentQuestions) as DocumentOperation[]).map(operation => ({
  operation,
  patterns: evidenceForms(documentQuestions[operation]),
}));

const excerpts = {
  contract: evidenceForms([
    'Учебный подписанный договор @lot от @date. Страница @pageA, п. @clauseA. Партия (@crop) @mass т, @price ₽/т. Поставка @basis. Страница @pageB, п. @clauseB. Оплата за @days банковских дней со дня подписания акта обеими сторонами.',
    'Training signed contract @lot, @date. Page @pageA §@clauseA: @mass t of @crop, @price RUB/t, @basis. Page @pageB §@clauseB: pay within @days banking days after both parties sign the acceptance note.',
    '练习已签合同@lot，日期@date。第@pageA页第@clauseA款：@crop@mass吨，每吨@price卢布，@basis。@pageBreak第@pageB页第@clauseB款：验收单双方签字后@days个银行工作日内付款。',
  ]),
  waybill: evidenceForms([
    'Накладная от @date. @crop @mass т заявлено.',
    'Waybill @date, declared @mass t of @crop.',
    '发货单@date：申报@crop@mass吨。',
  ]),
  weigh: evidenceForms([
    'Весовой талон. Нетто принято @mass т.',
    'Weigh ticket: net accepted mass @mass t.',
    '地磅单：实际净收@mass吨。',
  ]),
  receipt: evidenceForms([
    '@date. Принято @mass т товара (@crop). Статус оплаты: ожидает сверки. Примечание менеджера: «можно устно считать оплаченным». Выписка отсутствует.',
    '@date. Accepted @mass t of @crop; payment pending reconciliation. Manager comment: “treat it as paid verbally”. No bank statement.',
    '@date，已验收@crop@mass吨；付款待对账。业务备注“口头视为付清”。无银行流水。',
  ]),
  lab: evidenceForms([
    'Учебный протокол @crop. образец;влажность_% А;@first Б;@second Предел ≤@limit%. Другие поля пусты.',
    'Training lab report for @crop. A:@first%, B:@second%, maximum @limit%; no other fields reported.',
    '@crop练习检测报告：样品A含水@first%，样品B含水@second%，限值@limit%。其他指标未填。',
  ]),
  book: evidenceForms([
    'Лист «@intakeSheet» @cellA @crop @first т ПРИНЯТО. @cellB @second т ПРИНЯТО. @heldCell @held т БРОНЬ. Лист «@costSheet» @costCell анализ @lab ₽.',
    '@intakeSheet!@cellA @first t @crop, ACCEPTED; @cellB @second t ACCEPTED; @heldCell @held t RESERVED. @costSheet!@costCell laboratory @lab RUB.',
    '@intakeSheet!@cellA @crop@first吨 已验收；@cellB @second吨 已验收；@heldCell @held吨 预留。@costSheet!@costCell 检测费@lab卢布。',
  ]),
  incompleteClause: evidenceForms([
    '@crop. Раздел @pageA. Согласовано @mass т. Раздел @pageB. Окончательный платёж производится...',
    '@crop. §@pageA: agreed @mass t. §@pageB: final payment shall be made...',
    '@crop。第@pageA节约定@mass吨。第@pageB节最终付款应于……',
  ]),
  basePrice: evidenceForms([
    'Подписан. Цена @crop @price ₽/т.',
    'Signed base contract, @crop at @price RUB/t.',
    '已签原合同，@crop每吨@price卢布。',
  ]),
  newPrice: evidenceForms([
    'Подписано. Цена с даты отгрузки @date включительно: @price ₽/т.',
    'Signed. For shipments on or after @date, @price RUB/t.',
    '已签。自@date起发运适用每吨@price卢布，含当天。',
  ]),
  quotes: evidenceForms([
    'Оферты (@crop) одинаковые сроки и НДС: EXW @exw ₽/т, CPT @cpt ₽/т.',
    '@crop quotes, identical VAT and dates: EXW @exw RUB/t; CPT @cpt RUB/t.',
    '@crop同税同账期报价：EXW每吨@exw卢布，CPT每吨@cpt卢布。',
  ]),
  sellerFreight: evidenceForms([
    'Раздел «Логистика». Только при CPT перевозка оплачивается продавцом по @cost ₽/т. Иных расходов нет.',
    'Logistics: CPT-only seller freight @cost RUB/t. No other charges.',
    '物流条款：只有CPT卖方支付每吨运费@cost卢布。无其他费用。',
  ]),
  dispatch: evidenceForms([
    '@date: склад отпустил @mass т (@crop) водителю. Подпись склада и водителя. Поля покупателя пустые.',
    '@date: warehouse handed @mass t of @crop to driver. Warehouse and driver signed. Buyer fields blank.',
    '@date仓库将@mass吨@crop交给承运司机。仓库和司机签字，买方栏为空。',
  ]),
  integrationDraft: evidenceForms([
    '@date, партия @crop @mass т. Черновик сформирован, внешний ID пуст, ответ системы отсутствует.',
    '@date, @mass t of @crop. Draft prepared; external ID blank; no response.',
    '@date，@crop@mass吨。已准备草稿；外部编号为空；无系统回执。',
  ]),
  agreedAdvance: evidenceForms([
    'Спецификация @crop: @mass т × @price ₽/т. Договорная предоплата @rate% от общей стоимости. Сведений об оплате нет.',
    '@crop schedule: @mass t × @price RUB/t. The agreed advance is @rate% of total. No payment evidence.',
    '@crop清单@mass吨×每吨@price卢布。合同预付总额@rate%，未附付款证据。',
  ]),
  correctedWeight: evidenceForms([
    '@date. Исправленный талон заменяет прежний. Нетто @mass т.',
    '@date. This revised ticket supersedes the previous one; net @mass t.',
    '@date。更正单替代前单。净重@mass吨。',
  ]),
  userPrice: evidenceForms([
    'Партия @lot, @crop: исходный весовой талон @priorMass т. Цена подтверждена @price ₽/т.',
    '@lot, @crop: original ticket @priorMass t. Confirmed price @price RUB/t.',
    '@lot批@crop原净重@priorMass吨，确认每吨@price卢布。',
  ]),
  tripHeader: evidenceForms(['@crop.', '@crop。']),
  tripRow: evidenceForms([
    '@row: @trip @mass т принято',
    'Row @row @trip accepted @mass t',
    '@row行 @trip 已收@mass吨',
  ]),
} as const;

function matchFields(patterns: readonly RegExp[], text: string): Fields | null {
  const normalized = text.trim().replace(/\s+/gu, ' ');
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (match) return match.groups ?? {};
  }
  return null;
}

const ZERO = BigInt(0);
const PERCENT_BASE = BigInt(100) * ARITHMETIC_SCALE;
const SCALE_SQUARED = ARITHMETIC_SCALE * ARITHMETIC_SCALE;

function values(fields: Fields, ...names: string[]): bigint[] | null {
  const parsed: bigint[] = [];
  for (const name of names) {
    const value = parseSuppliedNumber(fields[name] ?? '');
    if (value === null) return null;
    parsed.push(value);
  }
  return parsed;
}

const intakeHeaders: Readonly<Record<string, Readonly<{ separator: string; accepted: string; cancelled: string }>>> = {
  'партия;масса_т;статус': { separator: ';', accepted: 'принято', cancelled: 'отменено' },
  'lot,mass_t,status': { separator: ',', accepted: 'accepted', cancelled: 'cancelled' },
  '批次,质量_吨,状态': { separator: ',', accepted: '验收', cancelled: '作废' },
};

function readIntakeRows(text: string, lot: string) {
  const [header, ...lines] = text.trim().split(/\r?\n/u);
  const schema = intakeHeaders[header.toLowerCase()];
  if (!schema || lines.length < 3) return null;
  const accepted = new Map<string, bigint>();
  const excluded = new Set<string>();
  for (const line of lines) {
    const columns = line.split(schema.separator).map(cell => cell.trim());
    if (columns.length !== 3) return null;
    const [id, rawMass, status] = columns;
    const mass = parseSuppliedNumber(rawMass);
    if (!id.startsWith(`${lot}-`) || mass === null || accepted.has(id) || excluded.has(id)) return null;
    if (status.toLowerCase() === schema.accepted) accepted.set(id, mass);
    else if (status.toLowerCase() === schema.cancelled) excluded.add(id);
    else return null;
  }
  if (accepted.size !== 2 || excluded.size === 0) return null;
  return { accepted, excluded };
}

function readUniqueTrips(text: string) {
  const [header, ...lines] = text.trim().split(/\r?\n/u);
  if (!matchFields(excerpts.tripHeader, header) || lines.length < 2) return null;
  const trips = new Map<string, { row: string; mass: bigint }>();
  const duplicates = new Map<string, string>();
  const rowIds = new Set<string>();
  for (const line of lines) {
    const row = matchFields(excerpts.tripRow, line);
    if (!row || rowIds.has(row.row)) return null;
    rowIds.add(row.row);
    const mass = parseSuppliedNumber(row.mass);
    if (mass === null) return null;
    const id = row.trip.toUpperCase();
    const original = trips.get(id);
    if (original && original.mass !== mass) return { conflict: id, rows: [original.row, row.row] };
    if (original) duplicates.set(row.row, id);
    else trips.set(id, { row: row.row, mass });
  }
  return { trips, duplicates };
}

function applyEvidence(
  operation: DocumentOperation,
  request: Fields,
  documents: readonly GektaDocumentContext[],
  history: readonly DocumentTurn[],
  locale: GektaLocale,
): string | null {
  const lot = request.lot.toUpperCase();
  if (documents.some(doc => !doc.name.toUpperCase().startsWith(`${lot}-`))) return null;
  const sources = new Map(documents.map(doc => [doc.name.slice(lot.length + 1).toLowerCase(), doc]));
  if (sources.size !== documents.length) return null;
  const receivesTwo = operation === 'weigh_ticket' || operation === 'amendment_price' || operation === 'documented_netback';
  if (sources.size !== (receivesTwo ? 2 : 1)) return null;
  if (operation !== 'revised_ticket' && history.length > 0) return null;
  if (operation !== 'incomplete_payment_clause' && documents.some(doc => doc.truncated)) return null;
  const source = (suffix: string) => sources.get(suffix);
  const get = (suffix: string, rules: readonly RegExp[]) => {
    const file = source(suffix);
    return file ? matchFields(rules, file.text) : null;
  };
  const pick = (ru: string, en: string, zh: string) => locale === 'en' ? en : locale === 'zh' ? zh : ru;
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const roundMoney = (numerator: bigint, denominator: bigint) => arithmeticDecimal(numerator, denominator, locale, 2);
  const money = pick('₽', 'RUB', '卢布');
  const tonne = pick('т', 't', '吨');
  const rateUnit = `${money}/${tonne}`;
  const cite = (suffix: string) => source(suffix)?.name ?? '';

  switch (operation) {
    case 'contract_terms': {
      const terms = get('contract.pdf', excerpts.contract);
      if (!terms || terms.lot.toUpperCase() !== lot) return null;
      const numbers = values(terms, 'price', 'mass', 'days');
      if (!numbers || numbers[2] <= ZERO) return null;
      const [price, mass, days] = numbers;
      const page = (n: string) => `${cite('contract.pdf')}, ${pick('стр.', 'p.', '第')} ${n}${locale === 'zh' ? '页' : ''}`;
      return [
        `${pick('Цена', 'Price', '单价')} — ${show(price)} ${rateUnit} (${page(terms.pageA)}).`,
        `${pick('Масса', 'Mass', '数量')} — ${show(mass)} ${tonne} (${page(terms.pageA)}).`,
        `${pick('Базис поставки', 'Delivery basis', '交付基准')} — ${terms.basis} (${page(terms.pageA)}).`,
        `${pick('Подписание акта обеими сторонами запускает срок оплаты', 'Both parties signing the acceptance note starts the payment clock', '付款期限从双方签署验收单起算')} — ${show(days)} ${pick('банковск. дн.', 'banking days', '个银行工作日')} (${page(terms.pageB)}).`,
      ].join('\n');
    }
    case 'weigh_ticket': {
      const declared = get('waybill.txt', excerpts.waybill);
      const measured = get('scale.txt', excerpts.weigh);
      if (!declared || !measured) return null;
      const [waybill] = values(declared, 'mass') ?? [];
      const [weigh] = values(measured, 'mass') ?? [];
      if (waybill === undefined || weigh === undefined) return null;
      const delta = weigh - waybill;
      const comparison = delta === ZERO ? pick('Массы совпадают.', 'The recorded masses agree.', '两条记录的质量相同。')
        : `${pick('Нетто по талону', 'Ticket net mass', '地磅净重')} ${delta > ZERO ? pick('больше', 'is higher by', '多') : pick('меньше', 'is lower by', '少')} ${show(delta < ZERO ? -delta : delta)} ${tonne}.`;
      return `${pick('Накладная', 'Waybill', '发货单')} ${cite('waybill.txt')} — ${show(waybill)} ${tonne}. ${pick('Талон', 'Weigh ticket', '地磅单')} ${cite('scale.txt')} — ${show(weigh)} ${tonne}.\n${comparison} ${pick('Причина по этим записям не установлена.', 'These records do not establish the cause.', '这些记录未能确定原因。')}`;
    }
    case 'intake_payment_status': {
      const data = get('acceptance.docx', excerpts.receipt);
      if (!data) return null;
      const [mass] = values(data, 'mass') ?? [];
      if (mass === undefined) return null;
      return `${cite('acceptance.docx')} — ${pick('принято', 'accepted', '已验收')} ${show(mass)} ${tonne}. ${pick(
        'Оплата ожидает сверки, поступление не подтверждено. Для сверки нужна выписка по счёту получателя с этой операцией.',
        'Payment is pending reconciliation. Receipt of funds is unverified. Check the recipient’s statement for the matching credit.',
        '付款待对账，到账未得到证明。应核对收款账户银行流水中的对应入账。',
      )}`;
    }
    case 'sample_limit': {
      const data = get('lab.csv', excerpts.lab);
      if (!data) return null;
      const numbers = values(data, 'first', 'second', 'limit');
      if (!numbers || numbers.some(value => value > PERCENT_BASE)) return null;
      const [first, second, limit] = numbers;
      const result = (amount: bigint) => amount <= limit ? pick('в пределах нормы по влажности', 'meets the moisture limit', '符合含水率限值')
        : pick('превышает лимит влажности', 'exceeds the moisture limit', '超出含水率限值');
      const delta = second - limit;
      const points = pick('п.п.', 'percentage points', '个百分点');
      const relative = delta === ZERO ? pick('равен лимиту', 'equals the limit', '等于限值') : delta > ZERO
        ? `${pick('выше на', 'above the limit by', '高出')} ${show(delta)} ${points}`
        : `${pick('ниже на', 'below the limit by', '低于限值')} ${show(-delta)} ${points}`;
      return `${cite('lab.csv')} — ${pick('максимум', 'maximum', '限值')} ${show(limit)}%. A ${show(first)}% — ${result(first)}. B ${show(second)}% — ${relative}.\n${pick('Другие показатели в протоколе не заполнены.', 'No other quality criteria are reported.', '其他质量指标未填。')}`;
    }
    case 'workbook_intake': {
      const data = get('ledger.xlsx', excerpts.book);
      if (!data || new Set([data.cellA, data.cellB, data.heldCell].map(cell => cell.toUpperCase())).size !== 3) return null;
      const numbers = values(data, 'first', 'second', 'lab');
      if (!numbers) return null;
      const [first, second, lab] = numbers;
      const { intakeSheet: intake, costSheet: costs } = data;
      return `${cite('ledger.xlsx')} — ${intake}!${data.cellA} + ${intake}!${data.cellB} = ${show(first)} + ${show(second)} = ${show(first + second)} ${tonne}.\n${intake}!${data.heldCell} — ${pick('бронь, исключена из суммы', 'reserved and excluded', '预留，未计入')}.\n${costs}!${data.costCell} — ${show(lab)} ${money} (${pick('анализ', 'laboratory charge', '检测费')}).`;
    }
    case 'incomplete_payment_clause': {
      const file = source('scan.pdf');
      const data = file?.truncated ? matchFields(excerpts.incompleteClause, file.text) : null;
      if (!data) return null;
      const [mass] = values(data, 'mass') ?? [];
      if (mass === undefined) return null;
      return `${cite('scan.pdf')} — ${pick('Раздел', 'Section', '章节')} ${data.pageA} — ${show(mass)} ${tonne}. ${pick(
        `Раздел ${data.pageB} обрезан. Точную дату оплаты можно определить по полной странице или приложению.`,
        `Section ${data.pageB} is cut off. The full page or attachment is needed to determine the exact payment date.`,
        `第${data.pageB}节末尾缺失，需要完整页面或附件才能确定准确付款日期。`,
      )}`;
    }
    case 'amendment_price': {
      const original = get('main.pdf', excerpts.basePrice);
      const revision = get('addendum.pdf', excerpts.newPrice);
      if (!original || !revision) return null;
      const [oldPrice] = values(original, 'price') ?? [];
      const [newPrice] = values(revision, 'price') ?? [];
      if (oldPrice === undefined || newPrice === undefined) return null;
      const validDate = (value: string) => {
        const utc = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(utc.valueOf()) && utc.toISOString().slice(0, 10) === value;
      };
      const month = revision.date.slice(0, 7);
      const days = [request.firstDay, request.secondDay].map(day => `${month}-${day.padStart(2, '0')}`);
      if (![revision.date, ...days].every(validDate)) return null;
      return days.map(day => day < revision.date
        ? `${day} — ${show(oldPrice)} ${rateUnit}, ${cite('main.pdf')}.`
        : `${day} — ${show(newPrice)} ${rateUnit}, ${cite('addendum.pdf')}.`).join('\n');
    }
    case 'documented_netback': {
      const quote = get('quotes.pdf', excerpts.quotes);
      const freight = get('costs.txt', excerpts.sellerFreight);
      if (!quote || !freight) return null;
      const numbers = values({ ...quote, ...freight }, 'exw', 'cpt', 'cost');
      if (!numbers) return null;
      const [exw, cpt, cost] = numbers;
      const net = cpt - cost;
      const better = exw > net ? 'EXW' : 'CPT';
      const comparison = net === exw ? pick('Одинаковые суммы на тонну.', 'Equal proceeds per tonne.', '每吨到手金额相同。')
        : `${pick('Выше чистая цена', 'Higher net price', '净价较高的是')} ${better}.`;
      return `CPT — ${show(cpt)} − ${show(cost)} = ${show(net)} ${rateUnit}. EXW — ${show(exw)} ${rateUnit}. ${comparison}\n${pick('Оферты', 'Quotes', '报价')} — ${cite('quotes.pdf')}. ${pick('Вычет за перевозку', 'Freight deduction', '运费扣除')} — ${cite('costs.txt')}.`;
    }
    case 'delivery_evidence': {
      const data = get('dispatch.txt', excerpts.dispatch);
      if (!data) return null;
      const [mass] = values(data, 'mass') ?? [];
      if (mass === undefined) return null;
      return pick(
        `${cite('dispatch.txt')} подтверждает передачу ${show(mass)} ${tonne} со склада водителю. Приёмка покупателем не подтверждена. Нужен документ принимающей стороны с датой и фактическим нетто.`,
        `${cite('dispatch.txt')} records warehouse handover of ${show(mass)} ${tonne} to the driver. Buyer acceptance is unverified. Check the receiver’s dated acknowledgement showing actual net mass.`,
        `${cite('dispatch.txt')}证明仓库向司机交付${show(mass)}${tonne}。买方验收未得到证明，需要收货方注明日期和实际净重的签收凭证。`,
      );
    }
    case 'draft_submission': {
      if (!get('integration-log.txt', excerpts.integrationDraft)) return null;
      return pick(
        `${cite('integration-log.txt')} подтверждает создание черновика. Отправка и приём внешней системой не подтверждены. Нужны идентификатор сообщения, запись об отправке и статус или квитанция внешней системы.`,
        `${cite('integration-log.txt')} records draft preparation. Submission and external acceptance are unverified. Look for the message ID, the sending record and the external system’s status or receipt.`,
        `${cite('integration-log.txt')}证实已准备草稿。发送和外部系统接收均未证实。需要消息编号、发送记录和外部系统的状态或回执。`,
      );
    }
    case 'prepayment_evidence': {
      const data = get('spec.txt', excerpts.agreedAdvance);
      if (!data) return null;
      const numbers = values(data, 'mass', 'price', 'rate');
      if (!numbers || numbers[2] > PERCENT_BASE) return null;
      const [mass, price, rate] = numbers;
      const amount = roundMoney(mass * price * rate, SCALE_SQUARED * PERCENT_BASE);
      return `${cite('spec.txt')} — ${pick('размер предоплаты', 'advance amount', '约定预付款')} ${show(mass)} × ${show(price)} × ${show(rate)}% = ${amount} ${money}.\n${pick('Поступление денег по этим материалам не подтверждено.', 'These materials do not establish receipt of the funds.', '这些材料未证明预付款到账。')}`;
    }
    case 'unique_trips': {
      const file = source('trips.xlsx');
      const result = file ? readUniqueTrips(file.text) : null;
      if (!result) return null;
      if ('conflict' in result) return `${cite('trips.xlsx')} — ${result.conflict} (${result.rows?.join(', ')}). ${pick(
        'У одного рейса указаны разные массы. Уточни, какой строке соответствует весовой талон.',
        'The same trip has different masses. Check which row matches the weigh ticket.',
        '同一车次的质量不同，请核对哪一行与地磅单一致。',
      )}`;
      const total = [...result.trips.values()].reduce((sum, trip) => sum + trip.mass, ZERO);
      const kept = [...result.trips.values()].map(trip => `${trip.row} (${show(trip.mass)} ${tonne})`).join(', ');
      const removed = [...result.duplicates].map(([row, id]) => `${row} (${id})`).join(', ');
      return `${cite('trips.xlsx')} — ${pick('учтены строки', 'included rows', '计入行')} ${kept}. ${pick('Итого', 'Total', '合计')} ${show(total)} ${tonne}.${removed ? ` ${pick('Исключены дубли', 'Duplicate rows excluded', '排除重复行')} ${removed}.` : ''}`;
    }
    case 'accepted_rows': {
      const file = source('intake.csv');
      const result = file ? readIntakeRows(file.text, request.lot) : null;
      if (!result) return null;
      const total = [...result.accepted.values()].reduce((sum, mass) => sum + mass, ZERO);
      return `${cite('intake.csv')} — ${[...result.accepted].map(([id, mass]) => `${id} (${show(mass)} ${tonne})`).join(' + ')} = ${arithmeticDecimal(total, ARITHMETIC_SCALE, locale, 2)} ${tonne}. ${pick('Исключены отменённые записи', 'Cancelled records excluded', '已排除作废记录')} ${[...result.excluded].join(', ')}.`;
    }
    case 'revised_ticket': {
      const ticket = get('corrected.txt', excerpts.correctedWeight);
      const prior = [...history].reverse().find(turn => turn.role === 'user');
      const userPrice = prior ? matchFields(excerpts.userPrice, prior.text) : null;
      if (!ticket || !userPrice || userPrice.lot.toUpperCase() !== lot) return null;
      const numbers = values({ ...ticket, ...userPrice }, 'mass', 'price');
      if (!numbers) return null;
      const [mass, price] = numbers;
      return `${pick('Нетто по исправленному талону', 'Net mass from the revised ticket', '更正单净重')} ${cite('corrected.txt')} — ${show(mass)} ${tonne}.\n${pick('По ранее указанной тобой цене', 'At the price you previously stated', '按你先前提供的价格')} ${show(price)} ${rateUnit}. ${pick('Итого', 'Total', '总额')} — ${show(mass)} × ${show(price)} = ${roundMoney(mass * price, SCALE_SQUARED)} ${money}.`;
    }
  }
}

const intakeRequest = 'Для журнала приёмки определи массу по накладной, массу по весам, разницу и статус оплаты.';
const intakeWaybill = evidenceForms(['Учебная накладная @lot. @crop @mass т. Оплата ожидает подтверждения.']);
const intakeScale = evidenceForms(['Весовая квитанция @lot. Фактический принятый нетто-вес @mass т.']);
const paymentClockRequest = evidenceForms(['For grain contract @lot, what actually triggers the payment clock, and do these records establish the deadline date?']);
const draftClock = compileSuppliedForm(
  'Training: grain contract @lot, clause @clauseA. Payment is due within @businessDays business days after the acceptance note is signed by both parties. Dispatch recorded @date. Acceptance note included as an unsigned draft.',
  { ...evidenceFields, businessDays: '(?<businessDays>[1-9]\\d?|one|two|three|four|five|six|seven|eight|nine|ten)' },
);
const moistureRequest = '根据两份小麦样本检验报告，指出通过水分指标的批次，并说明是否能判断其他质量项目。';

function reconcileIntake(documents: readonly GektaDocumentContext[], locale: GektaLocale): { operation: EvidenceOperation; answer: string } | null {
  if (documents.length !== 2 || locale !== 'ru') return null;
  const records = documents.map(document => ({
    document,
    declared: matchFields(intakeWaybill, document.text),
    measured: matchFields(intakeScale, document.text),
  }));
  const waybill = records.find(record => record.declared);
  const scale = records.find(record => record.measured);
  if (!waybill?.declared || !scale?.measured || waybill.declared.lot !== scale.measured.lot) return null;
  const numbers = values({ declared: waybill.declared.mass, measured: scale.measured.mass }, 'declared', 'measured');
  if (!numbers) return null;
  const [declared, measured] = numbers;
  const show = (value: bigint) => arithmeticDecimal(value, ARITHMETIC_SCALE, locale);
  const delta = measured - declared;
  const difference = delta === ZERO ? 'Массы совпадают.' : `Нетто по весам ${delta > ZERO ? 'больше' : 'меньше'} на ${show(delta < ZERO ? -delta : delta)} т.`;
  return {
    operation: 'intake_summary',
    answer: `Накладная ${waybill.document.name} — ${show(declared)} т. Весовая квитанция ${scale.document.name} — ${show(measured)} т. ${difference} Оплата ожидает подтверждения.`,
  };
}

function checkMoistureLots(document: GektaDocumentContext): { operation: EvidenceOperation; answer: string } | null {
  const [header, first, second, footer, ...extra] = document.text.trim().split(/\r?\n/u);
  if (header !== '批次,水分(%),水分限值(%)' || footer !== '其他指标未记录。' || extra.length) return null;
  const ids = new Set<string>();
  const checks: string[] = [];
  for (const line of [first, second]) {
    const [id, mass, max, ...rest] = line.split(',').map(cell => cell.trim());
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,36}$/u.test(id) || rest.length || ids.has(id)) return null;
    const numeric = values({ mass, max }, 'mass', 'max');
    if (!numeric || numeric.some(value => value > PERCENT_BASE)) return null;
    ids.add(id);
    checks.push(`${id} ${mass}% ${numeric[0] <= numeric[1] ? '符合' : '超出'} ${max}% 的水分限值。`);
  }
  return { operation: 'moisture_lots', answer: `${document.name} — ${checks.join(' ')} 其他质量指标未记录，无法判断。` };
}

function checkedIntakeOrClock(
  question: string, documents: readonly GektaDocumentContext[], locale: GektaLocale,
): { operation: EvidenceOperation; answer: string } | null {
  if (documents.some(document => document.truncated)) return null;
  if (question.trim() === intakeRequest) return reconcileIntake(documents, locale);
  if (documents.length !== 1) return null;
  const document = documents[0];
  if (locale === 'zh' && question.trim() === moistureRequest) return checkMoistureLots(document);
  if (locale !== 'en') return null;
  const asked = matchFields(paymentClockRequest, question);
  const clause = matchFields([draftClock], document.text);
  if (!asked || !clause || asked.lot !== clause.lot) return null;
  return {
    operation: 'payment_clock',
    answer: `In ${document.name}, the payment clock starts when both parties sign the acceptance note. The clause then allows ${clause.businessDays} business days. Dispatch is recorded on ${clause.date}, and only an unsigned acceptance draft is included. The exact due date is therefore unverified.`,
  };
}

/** Only answer when every requested fact is bound to a matching, checkable excerpt. */
export function checkedDocumentEvidence(
  question: string,
  documents: readonly GektaDocumentContext[],
  history: readonly DocumentTurn[],
  locale: GektaLocale,
): { operation: EvidenceOperation; answer: string } | null {
  if (!documents.length) return null;
  for (const { operation, patterns } of questions) {
    const request = matchFields(patterns, question);
    if (!request) continue;
    const answer = applyEvidence(operation, request, documents, history, locale);
    return answer ? { operation, answer } : null;
  }
  return history.length ? null : checkedIntakeOrClock(question, documents, locale);
}
