import { expect, test, type Locator, type Page } from '@playwright/test';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'storage'
  | 'laboratory'
  | 'surveyor'
  | 'bank'
  | 'employee';

type RoleExpectation = Readonly<{ key: RoleKey; label: string; lensSnippet: string }>;

const localeCopy: Record<Locale, Readonly<{
  rolesLabel: string;
  preview: string;
  responsibility: string;
  next: string;
  evidence: string;
  money: string;
  authorityBoundary: string;
}>> = {
  ru: {
    rolesLabel: 'Выберите роль для просмотра',
    preview: 'Упрощённый экран рабочего кабинета',
    responsibility: 'Ответственность',
    next: 'Следующее действие',
    evidence: 'Основание',
    money: 'Денежный смысл',
    authorityBoundary: 'критическое решение остаётся за уполномоченным участником',
  },
  en: {
    rolesLabel: 'Choose a role to preview',
    preview: 'Simplified workspace screen',
    responsibility: 'Responsibility',
    next: 'Next action',
    evidence: 'Basis',
    money: 'Money meaning',
    authorityBoundary: 'critical decisions stay with an authorised participant',
  },
  zh: {
    rolesLabel: '选择角色查看',
    preview: '简化工作空间界面',
    responsibility: '责任',
    next: '下一步',
    evidence: '依据',
    money: '资金含义',
    authorityBoundary: '关键决定仍由有权限的参与方作出',
  },
};

const roles: Record<Locale, readonly RoleExpectation[]> = {
  ru: [
    { key: 'seller', label: 'Продавец', lensSnippet: 'Условия товара' },
    { key: 'buyer', label: 'Покупатель', lensSnippet: 'Соответствие фактического исполнения' },
    { key: 'logistics', label: 'Логистика', lensSnippet: 'Партия, маршрут' },
    { key: 'driver', label: 'Водитель', lensSnippet: 'Только нужные для рейса' },
    { key: 'storage', label: 'Элеватор / хранение', lensSnippet: 'Приёмка партии' },
    { key: 'laboratory', label: 'Лаборатория', lensSnippet: 'Проба, методика' },
    { key: 'surveyor', label: 'Сюрвейер', lensSnippet: 'Цепочка фактов' },
    { key: 'bank', label: 'Банк / финансы', lensSnippet: 'Основание финансового действия' },
    { key: 'employee', label: 'Сотрудник платформы', lensSnippet: 'Причина исключения' },
  ],
  en: [
    { key: 'seller', label: 'Seller', lensSnippet: 'Product terms' },
    { key: 'buyer', label: 'Buyer', lensSnippet: 'Execution against terms' },
    { key: 'logistics', label: 'Logistics', lensSnippet: 'Lot, route' },
    { key: 'driver', label: 'Driver', lensSnippet: 'Only the route' },
    { key: 'storage', label: 'Elevator / storage', lensSnippet: 'Lot intake' },
    { key: 'laboratory', label: 'Laboratory', lensSnippet: 'Sample, method' },
    { key: 'surveyor', label: 'Surveyor', lensSnippet: 'fact and evidence chain' },
    { key: 'bank', label: 'Bank / finance', lensSnippet: 'basis for a financial action' },
    { key: 'employee', label: 'Platform employee', lensSnippet: 'Exception cause' },
  ],
  zh: [
    { key: 'seller', label: '卖方', lensSnippet: '商品条件' },
    { key: 'buyer', label: '买方', lensSnippet: '实际履约' },
    { key: 'logistics', label: '物流', lensSnippet: '批次、路线' },
    { key: 'driver', label: '司机', lensSnippet: '仅查看完成指定运输任务' },
    { key: 'storage', label: '筒仓 / 仓储', lensSnippet: '批次接收' },
    { key: 'laboratory', label: '实验室', lensSnippet: '样品、方法' },
    { key: 'surveyor', label: '检验机构', lensSnippet: '可用于独立核验' },
    { key: 'bank', label: '银行 / 金融', lensSnippet: '金融动作的依据' },
    { key: 'employee', label: '平台员工', lensSnippet: '异常原因' },
  ],
};

// Fixed acceptance oracle from #5129 comment 5570029305.
type RoleStageAction = Readonly<{ state: 'active' | 'inactive'; text: string }>;
type RoleStageActions = Record<Locale, Record<RoleKey, readonly [RoleStageAction, RoleStageAction, RoleStageAction, RoleStageAction, RoleStageAction, RoleStageAction, RoleStageAction]>>;

const expectedRoleStageActions: RoleStageActions = {
  ru: {
    seller: [
      {"state": "active", "text": "Подтвердить данные товара и условия своей стороны."},
      {"state": "active", "text": "Сопоставить предложения и подтвердить коммерческий выбор своей стороны."},
      {"state": "active", "text": "Подтвердить договорные условия и выполнить разрешённое действие своей стороны."},
      {"state": "active", "text": "Подготовить партию к передаче и выполнить согласованные обязательства по поставке."},
      {"state": "active", "text": "Проверить факты приёмки и качества и ответить на относящееся к продавцу отклонение."},
      {"state": "active", "text": "Передать или исправить документы продавца и проверить основание расчёта."},
      {"state": "active", "text": "Подтвердить закрытие своей части Сделки либо ответить на относящееся к продавцу исключение."},
    ],
    buyer: [
      {"state": "active", "text": "Подтвердить потребность и требования покупателя к товару и условиям."},
      {"state": "active", "text": "Сравнить предложения и выбрать допустимый коммерческий вариант своей стороны."},
      {"state": "active", "text": "Подтвердить договорные условия и выполнить разрешённое действие покупателя."},
      {"state": "active", "text": "Подтвердить условия приёмки и готовность своей стороны к согласованной поставке."},
      {"state": "active", "text": "Сопоставить приёмку и качество с условиями и принять решение в пределах роли покупателя."},
      {"state": "active", "text": "Проверить документы и основание расчёта и выполнить разрешённое действие покупателя."},
      {"state": "active", "text": "Подтвердить закрытие своей части Сделки либо действовать по относящемуся к покупателю исключению."},
    ],
    logistics: [
      {"state": "inactive", "text": "Активного действия нет: логистика подключается после появления подтверждённой потребности в перевозке."},
      {"state": "inactive", "text": "Активного действия нет: дождитесь коммерческой основы и параметров будущей перевозки."},
      {"state": "inactive", "text": "Активного действия нет: логистика начинает работу после создания транспортной задачи из согласованных условий."},
      {"state": "active", "text": "Сформировать и координировать транспортную задачу, маршрут и назначение перевозки."},
      {"state": "active", "text": "Зафиксировать относящиеся к перевозке факты доставки без решения за приёмку или качество."},
      {"state": "active", "text": "Передать или исправить транспортные документы и связанные факты перевозки."},
      {"state": "inactive", "text": "Активного действия нет: логистика возвращается только при транспортном исключении или корректировке."},
    ],
    driver: [
      {"state": "inactive", "text": "Активного действия нет: водитель подключается только после назначения конкретного рейса."},
      {"state": "inactive", "text": "Активного действия нет: коммерческий выбор не относится к полномочиям водителя."},
      {"state": "inactive", "text": "Активного действия нет: договорные решения не относятся к полномочиям водителя."},
      {"state": "active", "text": "Выполнить назначенный рейс и передать факты, относящиеся к своей транспортной задаче."},
      {"state": "inactive", "text": "Активного действия нет: вернитесь только если требуется уточнить факт рейса или передачи груза."},
      {"state": "inactive", "text": "Активного действия нет: вернитесь только если требуется исправить документ по своему рейсу."},
      {"state": "inactive", "text": "Активного действия нет: закрытие Сделки не является действием водителя."},
    ],
    storage: [
      {"state": "inactive", "text": "Активного действия нет: площадка хранения подключается при направлении конкретной партии на приёмку."},
      {"state": "inactive", "text": "Активного действия нет: выбор контрагента не относится к полномочиям площадки хранения."},
      {"state": "inactive", "text": "Активного действия нет: дождитесь основания для приёмки конкретной партии."},
      {"state": "inactive", "text": "Активного действия нет: роль активируется при фактическом поступлении партии на площадку."},
      {"state": "active", "text": "Зафиксировать приёмку, вес, размещение и факты движения партии на площадке."},
      {"state": "active", "text": "Передать документы и подтверждения площадки, относящиеся к принятой партии."},
      {"state": "inactive", "text": "Активного действия нет: вернитесь только при закрывающем факте хранения или исключении по площадке."},
    ],
    laboratory: [
      {"state": "inactive", "text": "Активного действия нет: лаборатория подключается после появления основания для исследования конкретной партии."},
      {"state": "inactive", "text": "Активного действия нет: коммерческий выбор не относится к полномочиям лаборатории."},
      {"state": "inactive", "text": "Активного действия нет: договорные решения сторон не являются лабораторным действием."},
      {"state": "inactive", "text": "Активного действия нет: дождитесь отбора/передачи образца или поручения на исследование."},
      {"state": "active", "text": "Принять образец, провести исследование по методике и зафиксировать результат по конкретной партии."},
      {"state": "active", "text": "Передать протокол или исправить лабораторный документ без принятия решения о расчёте."},
      {"state": "inactive", "text": "Активного действия нет: лаборатория возвращается только при назначенном повторном исследовании или споре о результате."},
    ],
    surveyor: [
      {"state": "inactive", "text": "Активного действия нет: сюрвейер подключается только после отдельного поручения на независимую проверку."},
      {"state": "inactive", "text": "Активного действия нет: коммерческий выбор не относится к полномочиям сюрвейера."},
      {"state": "inactive", "text": "Активного действия нет: договорные решения сторон не являются действием сюрвейера."},
      {"state": "inactive", "text": "Активного действия нет: дождитесь отдельного поручения и предмета независимой проверки."},
      {"state": "active", "text": "В пределах поручения зафиксировать независимые факты приёмки/качества и материалы проверки."},
      {"state": "active", "text": "Передать независимое заключение и относящиеся к нему материалы."},
      {"state": "inactive", "text": "Активного действия нет: вернитесь только при споре или назначенной финальной/повторной проверке."},
    ],
    bank: [
      {"state": "inactive", "text": "Активного действия нет: финансовый контур подключается после появления подтверждённого финансового основания."},
      {"state": "inactive", "text": "Активного действия нет: выбор товара и контрагента не является действием банка."},
      {"state": "inactive", "text": "Активного действия нет: банк не принимает договорное решение вместо сторон."},
      {"state": "inactive", "text": "Активного действия нет: транспортное исполнение не относится к финансовому контуру."},
      {"state": "inactive", "text": "Активного действия нет: приёмка и качество должны сначала сформировать подтверждённое финансовое основание."},
      {"state": "active", "text": "В пределах финансовых полномочий обработать подтверждённое основание и зафиксировать финансовый результат."},
      {"state": "active", "text": "Зафиксировать финансовый исход закрытия либо выполнить только назначенную финансовую корректировку/возврат."},
    ],
    employee: [
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы подключается только к назначенному контролируемому исключению."},
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы не выбирает контрагента за участника; только назначенное исключение активирует роль."},
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы не принимает договорное решение за сторону; роль активна только при назначенном исключении."},
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы не выполняет транспортную роль; подключение — только по назначенному исключению."},
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы не заменяет приёмку, лабораторию или стороны; подключение — только по исключению."},
      {"state": "inactive", "text": "Активного действия нет: сотрудник платформы не распоряжается средствами и не подтверждает расчёт за участников; только назначенное исключение."},
      {"state": "inactive", "text": "Активного действия нет без назначенного исключения; при исключении сотрудник только маршрутизирует Сделку к разрешённому следующему шагу."},
    ],
  },
  en: {
    seller: [
      {"state": "active", "text": "Confirm the seller’s product data and terms."},
      {"state": "active", "text": "Compare offers and confirm the seller-side commercial choice."},
      {"state": "active", "text": "Confirm contract terms and perform the seller-side permitted action."},
      {"state": "active", "text": "Prepare the lot for handover and perform agreed seller delivery obligations."},
      {"state": "active", "text": "Review acceptance/quality facts and respond to a seller-side deviation."},
      {"state": "active", "text": "Provide or correct seller documents and review the settlement basis."},
      {"state": "active", "text": "Confirm seller-side closure or respond to a seller-related exception."},
    ],
    buyer: [
      {"state": "active", "text": "Confirm the buyer’s demand and product/term requirements."},
      {"state": "active", "text": "Compare offers and select the buyer-side permitted commercial option."},
      {"state": "active", "text": "Confirm contract terms and perform the buyer-side permitted action."},
      {"state": "active", "text": "Confirm receiving conditions and buyer-side readiness for the agreed delivery."},
      {"state": "active", "text": "Compare acceptance/quality with terms and take the decision allowed to the buyer."},
      {"state": "active", "text": "Review documents and settlement basis and perform the buyer-side permitted action."},
      {"state": "active", "text": "Confirm buyer-side closure or act on a buyer-related exception."},
    ],
    logistics: [
      {"state": "inactive", "text": "No active action: logistics becomes relevant after a confirmed transport need exists."},
      {"state": "inactive", "text": "No active action: wait for the commercial basis and transport parameters."},
      {"state": "inactive", "text": "No active action: logistics starts after agreed terms create a transport task."},
      {"state": "active", "text": "Create and coordinate the transport task, route and assignment."},
      {"state": "active", "text": "Record delivery facts that belong to transport without deciding acceptance or quality."},
      {"state": "active", "text": "Provide or correct transport documents and related transport facts."},
      {"state": "inactive", "text": "No active action: logistics returns only for a transport exception or correction."},
    ],
    driver: [
      {"state": "inactive", "text": "No active action: the driver becomes relevant only after a specific trip is assigned."},
      {"state": "inactive", "text": "No active action: commercial selection is outside the driver’s authority."},
      {"state": "inactive", "text": "No active action: contract decisions are outside the driver’s authority."},
      {"state": "active", "text": "Perform the assigned trip and submit facts belonging to that transport task."},
      {"state": "inactive", "text": "No active action: return only if a trip or handover fact needs clarification."},
      {"state": "inactive", "text": "No active action: return only if a document for the assigned trip needs correction."},
      {"state": "inactive", "text": "No active action: Deal closure is not a driver action."},
    ],
    storage: [
      {"state": "inactive", "text": "No active action: storage becomes relevant when a specific lot is sent for intake."},
      {"state": "inactive", "text": "No active action: counterparty selection is outside storage authority."},
      {"state": "inactive", "text": "No active action: wait for the basis to receive a specific lot."},
      {"state": "inactive", "text": "No active action: the role activates when the lot physically arrives at the site."},
      {"state": "active", "text": "Record intake, weight, placement and lot-movement facts at the site."},
      {"state": "active", "text": "Provide storage-site documents and confirmations for the received lot."},
      {"state": "inactive", "text": "No active action: return only for a storage closure fact or site-related exception."},
    ],
    laboratory: [
      {"state": "inactive", "text": "No active action: the laboratory becomes relevant after there is a basis to test a specific lot."},
      {"state": "inactive", "text": "No active action: commercial selection is outside laboratory authority."},
      {"state": "inactive", "text": "No active action: party contract decisions are not laboratory actions."},
      {"state": "inactive", "text": "No active action: wait for sample handover or a testing assignment."},
      {"state": "active", "text": "Receive the sample, perform the test under the method and record the result for the exact lot."},
      {"state": "active", "text": "Provide the protocol or correct a laboratory document without making a settlement decision."},
      {"state": "inactive", "text": "No active action: the laboratory returns only for an assigned retest or a dispute about the result."},
    ],
    surveyor: [
      {"state": "inactive", "text": "No active action: the surveyor becomes relevant only after an independent inspection is commissioned."},
      {"state": "inactive", "text": "No active action: commercial selection is outside surveyor authority."},
      {"state": "inactive", "text": "No active action: party contract decisions are not surveyor actions."},
      {"state": "inactive", "text": "No active action: wait for a specific inspection commission and scope."},
      {"state": "active", "text": "Within the commission, record independent acceptance/quality facts and inspection evidence."},
      {"state": "active", "text": "Provide the independent conclusion and its supporting evidence."},
      {"state": "inactive", "text": "No active action: return only for a dispute or commissioned final/repeat inspection."},
    ],
    bank: [
      {"state": "inactive", "text": "No active action: finance becomes relevant after a confirmed financial basis exists."},
      {"state": "inactive", "text": "No active action: product/counterparty selection is not a bank action."},
      {"state": "inactive", "text": "No active action: the bank does not make the parties’ contract decision."},
      {"state": "inactive", "text": "No active action: transport execution is outside the financial circuit."},
      {"state": "inactive", "text": "No active action: acceptance/quality must first produce a confirmed financial basis."},
      {"state": "active", "text": "Within financial authority, process the confirmed basis and record the financial result."},
      {"state": "active", "text": "Record the financial closure outcome or perform only an assigned financial correction/reversal."},
    ],
    employee: [
      {"state": "inactive", "text": "No active action: a platform employee acts only on an assigned controlled exception."},
      {"state": "inactive", "text": "No active action: platform staff do not choose a counterparty for a participant; only an assigned exception activates the role."},
      {"state": "inactive", "text": "No active action: staff do not make a party’s contract decision; only an assigned exception activates the role."},
      {"state": "inactive", "text": "No active action: staff do not perform transport work; involvement is exception-only."},
      {"state": "inactive", "text": "No active action: staff do not replace acceptance, laboratory or party authority; involvement is exception-only."},
      {"state": "inactive", "text": "No active action: staff do not control participant funds or confirm settlement for them; exception-only."},
      {"state": "inactive", "text": "No active action without an assigned exception; when assigned, staff only route the Deal to an allowed next step."},
    ],
  },
  zh: {
    seller: [
      {"state": "active", "text": "确认卖方的商品数据和交易条件。"},
      {"state": "active", "text": "比较报价并确认卖方一侧的商业选择。"},
      {"state": "active", "text": "确认合同条件并执行卖方权限内的动作。"},
      {"state": "active", "text": "准备批次交付并完成卖方约定的交付义务。"},
      {"state": "active", "text": "核对接收和质量事实，并处理属于卖方的偏差。"},
      {"state": "active", "text": "提交或更正卖方文件，并核对结算依据。"},
      {"state": "active", "text": "确认卖方一侧的交易关闭，或处理与卖方相关的异常。"},
    ],
    buyer: [
      {"state": "active", "text": "确认买方需求以及对商品和条件的要求。"},
      {"state": "active", "text": "比较报价并选择买方权限内的商业方案。"},
      {"state": "active", "text": "确认合同条件并执行买方权限内的动作。"},
      {"state": "active", "text": "确认接收条件以及买方对约定交付的准备。"},
      {"state": "active", "text": "将接收和质量与约定条件核对，并作出买方权限内的决定。"},
      {"state": "active", "text": "核对文件和结算依据，并执行买方权限内的动作。"},
      {"state": "active", "text": "确认买方一侧的交易关闭，或处理与买方相关的异常。"},
    ],
    logistics: [
      {"state": "inactive", "text": "当前无主动操作：出现已确认的运输需求后物流角色才介入。"},
      {"state": "inactive", "text": "当前无主动操作：等待商业基础和运输参数明确。"},
      {"state": "inactive", "text": "当前无主动操作：约定条件生成运输任务后物流才开始工作。"},
      {"state": "active", "text": "创建并协调运输任务、路线和运输分配。"},
      {"state": "active", "text": "记录属于运输环节的交付事实，不替代接收或质量决定。"},
      {"state": "active", "text": "提交或更正运输文件及相关运输事实。"},
      {"state": "inactive", "text": "当前无主动操作：仅在运输异常或需要更正时重新介入。"},
    ],
    driver: [
      {"state": "inactive", "text": "当前无主动操作：只有分配具体运输任务后司机才介入。"},
      {"state": "inactive", "text": "当前无主动操作：商业选择不属于司机权限。"},
      {"state": "inactive", "text": "当前无主动操作：合同决定不属于司机权限。"},
      {"state": "active", "text": "完成已分配的运输任务并提交与该任务有关的事实。"},
      {"state": "inactive", "text": "当前无主动操作：仅在需要澄清运输或交接事实时处理。"},
      {"state": "inactive", "text": "当前无主动操作：仅在需要更正本次运输文件时处理。"},
      {"state": "inactive", "text": "当前无主动操作：交易关闭不属于司机动作。"},
    ],
    storage: [
      {"state": "inactive", "text": "当前无主动操作：具体批次进入接收入库时仓储角色才介入。"},
      {"state": "inactive", "text": "当前无主动操作：交易对手选择不属于仓储权限。"},
      {"state": "inactive", "text": "当前无主动操作：等待具体批次的接收依据。"},
      {"state": "inactive", "text": "当前无主动操作：批次实际到达仓储场地时角色才激活。"},
      {"state": "active", "text": "记录批次接收、重量、存放和场内移动事实。"},
      {"state": "active", "text": "提交与已接收批次有关的仓储文件和确认。"},
      {"state": "inactive", "text": "当前无主动操作：仅在仓储关闭事实或场地异常时处理。"},
    ],
    laboratory: [
      {"state": "inactive", "text": "当前无主动操作：具体批次形成检测依据后实验室才介入。"},
      {"state": "inactive", "text": "当前无主动操作：商业选择不属于实验室权限。"},
      {"state": "inactive", "text": "当前无主动操作：交易双方的合同决定不属于实验室动作。"},
      {"state": "inactive", "text": "当前无主动操作：等待样品交接或检测委托。"},
      {"state": "active", "text": "接收样品、按方法完成检测，并记录对应具体批次的结果。"},
      {"state": "active", "text": "提交检测报告或更正实验室文件，不作出结算决定。"},
      {"state": "inactive", "text": "当前无主动操作：仅在安排复检或对结果产生争议时重新介入。"},
    ],
    surveyor: [
      {"state": "inactive", "text": "当前无主动操作：只有收到独立检验委托后检验机构才介入。"},
      {"state": "inactive", "text": "当前无主动操作：商业选择不属于检验机构权限。"},
      {"state": "inactive", "text": "当前无主动操作：交易双方的合同决定不属于检验机构动作。"},
      {"state": "inactive", "text": "当前无主动操作：等待明确的独立检验委托和范围。"},
      {"state": "active", "text": "在委托范围内记录独立的接收/质量事实和检验材料。"},
      {"state": "active", "text": "提交独立检验结论及其支持材料。"},
      {"state": "inactive", "text": "当前无主动操作：仅在争议或安排最终/复检时重新介入。"},
    ],
    bank: [
      {"state": "inactive", "text": "当前无主动操作：形成已确认的金融依据后金融角色才介入。"},
      {"state": "inactive", "text": "当前无主动操作：商品或交易对手选择不属于银行动作。"},
      {"state": "inactive", "text": "当前无主动操作：银行不替交易双方作合同决定。"},
      {"state": "inactive", "text": "当前无主动操作：运输履约不属于金融环节。"},
      {"state": "inactive", "text": "当前无主动操作：接收和质量必须先形成已确认的金融依据。"},
      {"state": "active", "text": "在金融权限范围内处理已确认依据并记录金融结果。"},
      {"state": "active", "text": "记录交易关闭的金融结果，或仅执行已指定的金融更正/冲正。"},
    ],
    employee: [
      {"state": "inactive", "text": "当前无主动操作：平台员工仅在分配受控异常后介入。"},
      {"state": "inactive", "text": "当前无主动操作：平台员工不替参与方选择交易对手；只有分配异常后才激活。"},
      {"state": "inactive", "text": "当前无主动操作：平台员工不替任何一方作合同决定；仅在分配异常后激活。"},
      {"state": "inactive", "text": "当前无主动操作：平台员工不承担运输角色；仅在分配异常时介入。"},
      {"state": "inactive", "text": "当前无主动操作：平台员工不替代接收、实验室或交易方权限；仅处理异常。"},
      {"state": "inactive", "text": "当前无主动操作：平台员工不支配参与方资金，也不替其确认结算；仅处理异常。"},
      {"state": "inactive", "text": "未分配异常时无主动操作；出现已分配异常时，平台员工只把交易引导至允许的下一步。"},
    ],
  },
};

const visualViews = [
  { locale: 'ru' as const, width: 320, height: 800 },
  { locale: 'ru' as const, width: 390, height: 844 },
  { locale: 'ru' as const, width: 1280, height: 900 },
  { locale: 'en' as const, width: 390, height: 844 },
  { locale: 'zh' as const, width: 390, height: 844 },
] as const;

async function expectFullyVisibleAction(action: Locator, page: Page) {
  // IntersectionObserver can report 0.99999946 for a wholly visible subpixel
  // rectangle. Check all four actual CSS-coordinate bounds, without rounding.
  await expect(action).toBeInViewport();
  const box = await action.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openRoleWorkspace(page: Page, locale: Locale) {
  const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  const copy = localeCopy[locale];
  const workspace = page.getByRole('region', { name: copy.preview });
  await workspace.scrollIntoViewIfNeeded();
  await expect(workspace).toBeVisible();
  const tabs = page.getByRole('tablist', { name: copy.rolesLabel });
  await expect(tabs.getByRole('tab')).toHaveCount(9);
  return { copy, workspace, tabs };
}

test.describe('Phase 5 role-by-role human acceptance evidence', () => {
  for (const view of visualViews) {
    test(`${view.locale} ${view.width}px captures all nine role workspaces`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'Human visual evidence is captured once in Chromium; cross-browser role semantics are exercised separately.',
      );
      test.setTimeout(150_000);

      await page.setViewportSize({ width: view.width, height: view.height });
      const { copy, workspace, tabs } = await openRoleWorkspace(page, view.locale);
      const registerHref = `/platform-v7/register?lang=${view.locale}`;
      await expect(page.locator('.pc-v6-header-cta')).toHaveAttribute('href', registerHref);

      for (const role of roles[view.locale]) {
        const tab = tabs.getByRole('tab', { name: role.label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');

        const panel = page.locator('#public-role-panel');
        await expect(panel).toHaveAttribute('aria-labelledby', `public-role-tab-${role.key}`);
        await expect(panel).toContainText(role.lensSnippet);
        await expect(panel).toContainText(copy.responsibility);
        await expect(panel).toContainText(copy.next);
        await expect(panel).toContainText(copy.evidence);
        await expect(panel).toContainText(copy.money);
        await expect(workspace).toContainText(copy.authorityBoundary, { ignoreCase: true });
        await expectNoHorizontalOverflow(page);

        await workspace.screenshot({
          path: testInfo.outputPath(`phase5-role-${view.locale}-${view.width}px-${role.key}.png`),
          animations: 'disabled',
        });
        // Keep the original complete workspace evidence and also capture the
        // actual viewport; fixed chrome inside tall stitched crops is misleading.
        const action = panel.locator('[data-role-action-state]');
        await action.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await expectFullyVisibleAction(action, page);
        await page.screenshot({ path: testInfo.outputPath(`phase5-viewport-${view.locale}-${view.width}px-${role.key}.png`), animations: 'disabled', caret: 'initial' });
      }
    });
  }

  test('all nine roles remain keyboard reachable and authority-bounded across browsers', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const { copy, workspace, tabs } = await openRoleWorkspace(page, 'ru');
    const roleTabs = tabs.getByRole('tab');

    // Buyer is the default state. Home moves to the first role, then ArrowRight
    // must traverse the complete public role set without changing authority.
    await roleTabs.nth(1).focus();
    await page.keyboard.press('Home');

    for (let index = 0; index < roles.ru.length; index += 1) {
      if (index > 0) await page.keyboard.press('ArrowRight');
      const role = roles.ru[index]!;
      const tab = roleTabs.nth(index);
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(tab).toHaveText(role.label);

      const panel = page.locator('#public-role-panel');
      await expect(panel).toHaveAttribute('aria-labelledby', `public-role-tab-${role.key}`);
      await expect(panel).toContainText(role.lensSnippet);
      await expect(panel).toContainText(copy.responsibility);
      await expect(panel).toContainText(copy.next);
      await expect(panel).toContainText(copy.evidence);
      await expect(panel).toContainText(copy.money);
    }

    const roleExperience = workspace.locator('xpath=..');
    await expect(roleExperience).toContainText('публичный пример', { ignoreCase: true });
    await expect(workspace).toContainText(copy.authorityBoundary, { ignoreCase: true });
    await expect(page.locator('.pc-v6-header-cta')).toHaveAttribute('href', '/platform-v7/register?lang=ru');
    await expectNoHorizontalOverflow(page);
  });
});

for (const locale of ['ru', 'en', 'zh'] as const) {
  test(`all 63 role-stage action boundaries are exact in ${locale}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const forbiddenRequests: string[] = [];
    page.on('request', request => {
      if (/bank-callback|role-assignment|membership|\/api\/proxy\//i.test(request.url())) forbiddenRequests.push(request.url());
    });
    const { workspace, tabs } = await openRoleWorkspace(page, locale);
    const stages = workspace.getByRole('button');
    await expect(stages).toHaveCount(7);
    let exercised = 0;
    for (const role of roles[locale]) {
      const expected = expectedRoleStageActions[locale][role.key];
      expect(expected).toHaveLength(7);
      const tab = tabs.getByRole('tab', { name: role.label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      for (let stage = 0; stage < 7; stage += 1) {
        await stages.nth(stage).click();
        await expect(stages.nth(stage)).toHaveAttribute('aria-current', 'step');
        const panel = page.locator('#public-role-panel');
        const action = panel.locator('[data-role-action-state]');
        await expect(panel).toHaveAttribute('aria-labelledby', `public-role-tab-${role.key}`);
        await expect(action).toHaveAttribute('data-role-action-state', expected[stage]!.state);
        await expect(action.locator('strong')).toHaveText(expected[stage]!.text);
        await action.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await expectFullyVisibleAction(action, page);
        const obscured = await action.evaluate(node => {
          const target = node.getBoundingClientRect();
          return Array.from(document.querySelectorAll('[data-public-site-header], .pc-public-contact-dock')).some(other => {
            const box = other.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && box.left < target.right && box.right > target.left && box.top < target.bottom && box.bottom > target.top;
          });
        });
        expect(obscured, `${locale}/${role.key}/${stage + 1} action must not sit under fixed controls`).toBe(false);
        await expect(panel).toContainText(role.lensSnippet);
        await expectNoHorizontalOverflow(page);
        exercised += 1;
      }
    }
    expect(exercised).toBe(63);
    expect(forbiddenRequests).toEqual([]);
    const activeCounts = roles[locale].map(role => expectedRoleStageActions[locale][role.key].filter(item => item.state === 'active').length);
    expect(activeCounts).toEqual([7, 7, 3, 1, 2, 2, 2, 2, 0]);
  });
}

async function expectSelectedRoleRevealed(tab: Locator) {
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => tab.evaluate(node => {
    const rail = node.parentElement!;
    const box = node.getBoundingClientRect();
    const parent = rail.getBoundingClientRect();
    const style = window.getComputedStyle(rail);
    const left = parent.left + (Number.parseFloat(style.borderLeftWidth) || 0);
    const right = parent.right - (Number.parseFloat(style.borderRightWidth) || 0);
    return box.left >= left && box.right <= right;
  }), { message: 'The entire selected role label must be inside the horizontal rail' }).toBe(true);
}

for (const locale of ['ru', 'en', 'zh'] as const) {
  test(`selected role labels are fully revealed without moving the page in ${locale}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 844 });
    const { tabs } = await openRoleWorkspace(page, locale);
    await tabs.getByRole('tab').last().dispatchEvent('click');
    for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      // Width changes must reveal the current role without another selection.
      await expectSelectedRoleRevealed(tabs.locator('[aria-selected="true"]'));
      await tabs.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      const pageY = await page.evaluate(() => window.scrollY);
      for (const role of roles[locale]) {
        const tab = tabs.getByRole('tab', { name: role.label, exact: true });
        // Neither Playwright auto-scroll nor browser focus may supply the reveal.
        await tab.dispatchEvent('click');
        await expectSelectedRoleRevealed(tab);
        expect(await page.evaluate(() => window.scrollY), `${locale}/${width}/${role.key}: no vertical jump`).toBe(pageY);
      }
      await expectNoHorizontalOverflow(page);
    }
  });
}
