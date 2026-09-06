'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  CircleDollarSign,
  FileCheck2,
  MapPinned,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import styles from './PublicDealRoleScenario.module.css';

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

type RoleScenario = {
  label: string;
  lens: string;
  responsibility: string;
  money: string;
};

type StageScenario = {
  label: string;
  focus: string;
  title: string;
  explanation: string;
  next: string;
  evidence: string;
  cards: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ];
  gekta: string;
};

type UiCopy = {
  label: string;
  rolesLabel: string;
  note: string;
  preview: string;
  deal: string;
  stageLabel: string;
  stageContext: string;
  roleLens: string;
  responsibility: string;
  next: string;
  evidence: string;
  money: string;
  gekta: string;
  gektaLimit: string;
};

const roleKeys: readonly RoleKey[] = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'storage',
  'laboratory',
  'surveyor',
  'bank',
  'employee',
];

const scenarios: Record<Locale, Record<RoleKey, RoleScenario>> = {
  ru: {
    seller: { label: 'Продавец', lens: 'Условия товара, обязательства по партии, документы и денежное последствие изменений.', responsibility: 'Передать достоверные данные о товаре и выполнить согласованную часть Сделки.', money: 'Понимать, из каких условий и фактов складывается итоговый расчёт.' },
    buyer: { label: 'Покупатель', lens: 'Соответствие фактического исполнения условиям, качество, документы и основания расчёта.', responsibility: 'Сопоставить исполнение с условиями и принять разрешённое решение своей стороны.', money: 'Понимать влияние качества, объёма, услуг и исключений на расчёт.' },
    logistics: { label: 'Логистика', lens: 'Партия, маршрут, транспортная задача, точки передачи и связанные документы.', responsibility: 'Организовать перевозку и зафиксировать относящиеся к ней события.', money: 'Отделять стоимость перевозки и её основание от расчёта за товар.' },
    driver: { label: 'Водитель', lens: 'Только нужные для рейса маршрут, груз, точки и действия.', responsibility: 'Выполнить назначенную транспортную задачу и передать относящиеся к ней факты.', money: 'Не видеть лишние коммерческие данные Сделки за пределами своей роли.' },
    storage: { label: 'Элеватор / хранение', lens: 'Приёмка партии, вес, размещение, движение и документы по хранению.', responsibility: 'Зафиксировать относящиеся к площадке факты по партии.', money: 'Связывать услуги хранения и фактические события с конкретной Сделкой.' },
    laboratory: { label: 'Лаборатория', lens: 'Проба, методика, измерение, протокол и связь результата с конкретной партией.', responsibility: 'Передать результат исследования в прослеживаемом виде.', money: 'Показывать качество как основание расчёта, не превращая лабораторию в сторону расчёта.' },
    surveyor: { label: 'Сюрвейер', lens: 'Цепочка фактов и материалов, доступных для независимой проверки.', responsibility: 'Зафиксировать независимое заключение в пределах порученной проверки.', money: 'Давать доказательство для решения сторон, перерасчёта или спора.' },
    bank: { label: 'Банк / финансы', lens: 'Основание финансового действия и связанные с ним документы Сделки.', responsibility: 'Работать только в пределах финансового контура и предоставленных полномочий.', money: 'Связывать движение денег с понятным основанием, не подменяя решение сторон.' },
    employee: { label: 'Сотрудник платформы', lens: 'Причина исключения, ответственный, полномочия, срок и история решений.', responsibility: 'Помочь вернуть Сделку к допустимому следующему шагу без присвоения роли участника.', money: 'Видеть денежное последствие исключения без права распоряжаться средствами участников.' },
  },
  en: {
    seller: { label: 'Seller', lens: 'Product terms, lot obligations, documents and the monetary impact of changes.', responsibility: 'Provide accurate product data and perform the seller side of the agreed Deal.', money: 'Understand how terms and execution facts form the settlement basis.' },
    buyer: { label: 'Buyer', lens: 'Execution against terms, quality, documents and settlement grounds.', responsibility: 'Compare execution with the agreed terms and take the action allowed to the buyer.', money: 'Understand how quality, volume, services and exceptions affect settlement.' },
    logistics: { label: 'Logistics', lens: 'Lot, route, transport task, handover points and transport documents.', responsibility: 'Organise transport and record the events that belong to it.', money: 'Keep freight cost and its basis separate from product settlement.' },
    driver: { label: 'Driver', lens: 'Only the route, cargo, points and actions required for the assigned trip.', responsibility: 'Perform the transport task and submit the facts that belong to it.', money: 'Avoid unrelated commercial Deal data outside the driver role.' },
    storage: { label: 'Elevator / storage', lens: 'Lot intake, weight, placement, movement and storage documents.', responsibility: 'Record the lot facts that belong to the storage site.', money: 'Link storage services and physical events to the specific Deal.' },
    laboratory: { label: 'Laboratory', lens: 'Sample, method, measurement, protocol and the link to the exact lot.', responsibility: 'Provide the research result in a traceable form.', money: 'Provide quality evidence without turning the laboratory into a settlement party.' },
    surveyor: { label: 'Surveyor', lens: 'The fact and evidence chain available for independent inspection.', responsibility: 'Record an independent conclusion within the assigned inspection scope.', money: 'Provide evidence for party decisions, recalculation or dispute.' },
    bank: { label: 'Bank / finance', lens: 'The basis for a financial action and its related Deal documents.', responsibility: 'Operate only inside the financial circuit and granted authority.', money: 'Link money movement to a clear basis without replacing party decisions.' },
    employee: { label: 'Platform employee', lens: 'Exception cause, owner, authority, deadline and decision history.', responsibility: 'Help return the Deal to an allowed next step without inheriting a participant role.', money: 'See the monetary consequence of an exception without authority over participant funds.' },
  },
  zh: {
    seller: { label: '卖方', lens: '商品条件、批次义务、文件以及变更带来的资金影响。', responsibility: '提供准确的商品数据，并完成交易中属于卖方的约定义务。', money: '理解条件和履约事实如何形成结算依据。' },
    buyer: { label: '买方', lens: '实际履约与约定条件的对应关系、质量、文件和结算依据。', responsibility: '将履约情况与约定条件进行核对，并执行买方权限内的动作。', money: '理解质量、数量、服务和异常如何影响结算。' },
    logistics: { label: '物流', lens: '批次、路线、运输任务、交接点和运输文件。', responsibility: '组织运输并记录与运输相关的事件。', money: '将运费及其依据与商品结算分开。' },
    driver: { label: '司机', lens: '仅查看完成指定运输任务所需的路线、货物、地点和操作。', responsibility: '完成运输任务并提交与该任务相关的事实。', money: '不接触司机角色之外的无关商业信息。' },
    storage: { label: '筒仓 / 仓储', lens: '批次接收、重量、存放、移动和仓储文件。', responsibility: '记录属于仓储现场的批次事实。', money: '把仓储服务和实际事件关联到具体交易。' },
    laboratory: { label: '实验室', lens: '样品、方法、测量、报告以及结果与具体批次的关联。', responsibility: '以可追溯的形式提交检测结果。', money: '提供质量依据，但不让实验室成为结算决策方。' },
    surveyor: { label: '检验机构', lens: '可用于独立核验的事实链和材料。', responsibility: '在受托范围内记录独立结论。', money: '为双方决定、重算或争议提供依据。' },
    bank: { label: '银行 / 金融', lens: '金融动作的依据以及与之关联的交易文件。', responsibility: '仅在金融环节和授权范围内工作。', money: '把资金流动与清晰依据关联起来，而不替代交易双方决定。' },
    employee: { label: '平台员工', lens: '异常原因、责任方、权限、期限和决定历史。', responsibility: '在不获得参与方角色的前提下，帮助交易回到允许的下一步。', money: '可以看到异常的资金影响，但无权支配参与方资金。' },
  },
};

const stages: Record<Locale, readonly StageScenario[]> = {
  ru: [
    { label: 'Товар и условия', focus: 'Предмет Сделки', title: 'Сначала стороны работают с одной версией товара и условий', explanation: 'Объём, качество, базис, допуски, документы и правила расчёта собираются вокруг одной будущей Сделки.', next: 'Сопоставить потребность и предложение и перейти к выбору контрагента.', evidence: 'Карточка товара или потребности, условия и версия предложения.', cards: [['Товар', 'Культура, объём и характеристики'], ['Условия', 'Базис, допуски и правила'], ['Документы', 'Что потребуется по Сделке'], ['Расчёт', 'Как условия влияют на деньги']], gekta: 'Помогает разложить условия по смыслу, заметить противоречия и объяснить влияние параметров на дальнейший путь Сделки.' },
    { label: 'Торги и контрагент', focus: 'Коммерческий выбор', title: 'Предложения и контрагент остаются частью той же истории', explanation: 'Сравнение условий, ставки и выбор стороны не отрываются от исходного товара и требований.', next: 'Зафиксировать согласованную коммерческую основу и перейти к договору.', evidence: 'Предложения, версии условий и выбранная коммерческая конфигурация.', cards: [['Предложения', 'Цена и ключевые условия'], ['Контрагент', 'Данные стороны Сделки'], ['Сравнение', 'Различия по условиям'], ['Решение', 'Основание коммерческого выбора']], gekta: 'Помогает сравнить предложения по одинаковым критериям и объяснить различия без принятия решения за пользователя.' },
    { label: 'Сделка и договор', focus: 'Обязательства сторон', title: 'Договор продолжает уже собранную коммерческую историю', explanation: 'Условия, версии документов, полномочия и действия сторон связываются с одной Сделкой.', next: 'Согласовать необходимые документы и перейти к исполнению.', evidence: 'Версия условий, договорные документы, роли и история согласования.', cards: [['Условия', 'Единая версия договорённостей'], ['Стороны', 'Роли и полномочия'], ['Документы', 'Связанные версии'], ['Действие', 'Что должен сделать участник']], gekta: 'Помогает найти расхождения между версиями, объяснить формулировки и подготовить варианты следующего допустимого действия.' },
    { label: 'Логистика и поставка', focus: 'Физическое исполнение', title: 'Партия, маршрут и услуги не живут отдельно от Сделки', explanation: 'Транспорт, водитель, точки, элеватор и другие услуги привязаны к конкретной партии и обязательствам.', next: 'Передать факты поставки в контекст приёмки и качества.', evidence: 'Партия, маршрут, транспортные события и относящиеся к ним документы.', cards: [['Партия', 'Что именно перевозится'], ['Маршрут', 'Откуда, куда и по какой задаче'], ['Участники', 'Кто отвечает за участок пути'], ['Документы', 'Что сопровождает перевозку']], gekta: 'Помогает собрать разрозненные события маршрута в понятную последовательность и показать, какие факты важны для следующего шага.' },
    { label: 'Приёмка и качество', focus: 'Фактическое исполнение', title: 'Приёмка и качество сопоставляются с согласованными условиями', explanation: 'Вес, проба, методика, протокол и отклонения рассматриваются вместе с исходной версией условий.', next: 'Определить, какие документы и расчётные действия следуют из фактов исполнения.', evidence: 'Вес, приёмка, проба, методика, протокол и договорные условия.', cards: [['Приёмка', 'Факты по партии'], ['Качество', 'Показатели и методика'], ['Сопоставление', 'Факт против условия'], ['Последствие', 'Что меняется дальше']], gekta: 'Помогает сопоставить показатели с условиями, объяснить расхождение и показать варианты действий, оставляя решение уполномоченному участнику.' },
    { label: 'Документы и расчёт', focus: 'Основание денег', title: 'Документы и расчёт опираются на ту же историю исполнения', explanation: 'Суммы, корректировки, услуги и документы читаются через факты уже пройденных шагов Сделки.', next: 'Проверить комплект оснований и подготовить закрытие или обработку исключения.', evidence: 'Условия, исполнение, документы, расчётная версия и решения участников.', cards: [['Основание', 'Что влияет на расчёт'], ['Документы', 'Какой комплект нужен'], ['Услуги', 'Отдельные денежные основания'], ['Итог', 'Как складывается сумма']], gekta: 'Помогает объяснить структуру расчёта, показать источник каждого изменения и найти несогласованность между фактом, документом и суммой.' },
    { label: 'Закрытие', focus: 'Итоговая история', title: 'Нормальное завершение и исключения остаются внутри одной Сделки', explanation: 'Закрытие, перерасчёт, возврат, спор и доказательства не создают параллельную историю вне сделки.', next: 'Сохранить итоговую связную историю и перейти к следующим операциям организации.', evidence: 'Полная цепочка условий, исполнения, документов, решений и расчёта.', cards: [['Итог', 'Что произошло по Сделке'], ['Исключения', 'Какое решение принято'], ['Доказательства', 'На чём основан итог'], ['История', 'Что остаётся для аудита']], gekta: 'Помогает собрать итог в понятное объяснение: что произошло, почему изменился результат и на какие материалы опирались действия участников.' },
  ],
  en: [
    { label: 'Product and terms', focus: 'Deal subject', title: 'The parties start from one version of the product and terms', explanation: 'Volume, quality, basis, tolerances, documents and settlement rules stay around one future Deal.', next: 'Match demand and offer, then move to counterparty selection.', evidence: 'Product or demand card, terms and offer version.', cards: [['Product', 'Crop, volume and characteristics'], ['Terms', 'Basis, tolerances and rules'], ['Documents', 'What the Deal will require'], ['Settlement', 'How terms affect money']], gekta: 'Helps structure the terms, spot contradictions and explain how parameters affect the rest of the Deal.' },
    { label: 'Bidding and counterparty', focus: 'Commercial choice', title: 'Offers and counterparty selection stay inside the same history', explanation: 'Comparisons, bids and party selection remain connected to the original product and requirements.', next: 'Capture the agreed commercial basis and move to contract.', evidence: 'Offers, term versions and selected commercial configuration.', cards: [['Offers', 'Price and key terms'], ['Counterparty', 'Deal party data'], ['Comparison', 'Differences across terms'], ['Decision', 'Basis for commercial choice']], gekta: 'Helps compare offers by the same criteria and explain differences without making the decision for the user.' },
    { label: 'Deal and contract', focus: 'Party obligations', title: 'The contract continues the commercial history already assembled', explanation: 'Terms, document versions, authority and party actions remain linked to one Deal.', next: 'Agree the required documents and move into execution.', evidence: 'Term version, contract documents, roles and agreement history.', cards: [['Terms', 'One agreed version'], ['Parties', 'Roles and authority'], ['Documents', 'Linked versions'], ['Action', 'What the participant does next']], gekta: 'Helps find differences between versions, explain clauses and prepare options for the next allowed action.' },
    { label: 'Logistics and delivery', focus: 'Physical execution', title: 'Lot, route and services do not become a separate story', explanation: 'Transport, driver, points, storage and other services remain linked to the lot and Deal obligations.', next: 'Bring delivery facts into acceptance and quality context.', evidence: 'Lot, route, transport events and related documents.', cards: [['Lot', 'What is being moved'], ['Route', 'Origin, destination and task'], ['Participants', 'Who owns each leg'], ['Documents', 'What accompanies transport']], gekta: 'Helps turn route events into a readable sequence and show which facts matter for the next step.' },
    { label: 'Acceptance and quality', focus: 'Actual execution', title: 'Acceptance and quality are compared with the agreed terms', explanation: 'Weight, sample, method, protocol and deviations are read together with the original Deal terms.', next: 'Determine which document and settlement actions follow from execution facts.', evidence: 'Weight, acceptance, sample, method, protocol and contract terms.', cards: [['Acceptance', 'Lot execution facts'], ['Quality', 'Indicators and method'], ['Comparison', 'Fact against term'], ['Impact', 'What changes next']], gekta: 'Helps compare indicators with terms, explain the difference and show action options while leaving the decision to an authorised participant.' },
    { label: 'Documents and settlement', focus: 'Money basis', title: 'Documents and settlement rely on the same execution history', explanation: 'Amounts, adjustments, services and documents are read through the facts collected in earlier Deal steps.', next: 'Check the basis set and prepare closure or exception handling.', evidence: 'Terms, execution, documents, calculation version and participant decisions.', cards: [['Basis', 'What affects settlement'], ['Documents', 'Which set is required'], ['Services', 'Separate money grounds'], ['Outcome', 'How the amount is formed']], gekta: 'Helps explain the calculation structure, show the source of each change and find inconsistencies between fact, document and amount.' },
    { label: 'Closure', focus: 'Final history', title: 'Normal completion and exceptions remain inside one Deal', explanation: 'Closure, recalculation, return, dispute and evidence do not create a parallel history outside the Deal.', next: 'Keep the final connected history and move to the organisation’s next operations.', evidence: 'The complete chain of terms, execution, documents, decisions and settlement.', cards: [['Outcome', 'What happened in the Deal'], ['Exceptions', 'Which decision was taken'], ['Evidence', 'What supports the outcome'], ['History', 'What remains for audit']], gekta: 'Helps turn the final history into a readable explanation of what happened, why the result changed and which materials supported participant actions.' },
  ],
  zh: [
    { label: '商品与条件', focus: '交易标的', title: '双方从同一份商品和条件开始', explanation: '数量、质量、交付基础、允许偏差、文件和结算规则都围绕同一笔交易组织。', next: '匹配需求与报价，然后进入交易方选择。', evidence: '商品或需求卡、条件和报价版本。', cards: [['商品', '品类、数量和特征'], ['条件', '基础、允许偏差和规则'], ['文件', '交易需要哪些材料'], ['结算', '条件如何影响资金']], gekta: '帮助梳理条件、发现矛盾，并解释参数如何影响后续交易流程。' },
    { label: '竞价与交易方', focus: '商业选择', title: '报价和交易方选择仍属于同一段交易历史', explanation: '比较、出价和选择交易方都与原始商品和要求保持关联。', next: '记录达成一致的商业基础并进入合同环节。', evidence: '报价、条件版本和最终选择的商业配置。', cards: [['报价', '价格和关键条件'], ['交易方', '交易参与方数据'], ['比较', '条件之间的差异'], ['决定', '商业选择依据']], gekta: '帮助按同一标准比较报价并解释差异，但不替用户作出选择。' },
    { label: '交易与合同', focus: '双方义务', title: '合同继续已经形成的商业历史', explanation: '条件、文件版本、权限和双方动作都关联到同一笔交易。', next: '完成必要文件协同并进入履约。', evidence: '条件版本、合同文件、角色和协同历史。', cards: [['条件', '同一份约定版本'], ['双方', '角色和权限'], ['文件', '相关版本'], ['动作', '参与方下一步']], gekta: '帮助查找版本差异、解释条款，并准备下一步允许动作的选项。' },
    { label: '物流与交付', focus: '实际履约', title: '批次、路线和服务不会变成另一套孤立流程', explanation: '运输、司机、地点、仓储和其他服务都与具体批次和交易义务关联。', next: '把交付事实带入验收和质量环节。', evidence: '批次、路线、运输事件和相关文件。', cards: [['批次', '运输的具体对象'], ['路线', '起点、终点和任务'], ['参与方', '每段由谁负责'], ['文件', '运输随附材料']], gekta: '帮助把路线事件整理为清晰顺序，并指出下一步需要关注哪些事实。' },
    { label: '验收与质量', focus: '履约事实', title: '验收和质量与约定条件放在一起比较', explanation: '重量、样品、方法、报告和偏差都与最初的交易条件一起查看。', next: '根据履约事实确定后续文件和结算动作。', evidence: '重量、验收、样品、方法、报告和合同条件。', cards: [['验收', '批次履约事实'], ['质量', '指标和方法'], ['比较', '事实与条件'], ['影响', '下一步发生什么']], gekta: '帮助将指标与条件进行比较、解释差异并展示可选动作，最终决定仍由有权限的参与方作出。' },
    { label: '文件与结算', focus: '资金依据', title: '文件和结算沿用同一份履约历史', explanation: '金额、调整、服务和文件都通过前面步骤收集的交易事实来理解。', next: '检查依据材料并准备结束交易或处理异常。', evidence: '条件、履约、文件、计算版本和参与方决定。', cards: [['依据', '什么影响结算'], ['文件', '需要哪些材料'], ['服务', '独立的资金依据'], ['结果', '金额如何形成']], gekta: '帮助解释计算结构、说明每项变化的来源，并发现事实、文件和金额之间的不一致。' },
    { label: '关闭', focus: '最终历史', title: '正常结束和异常处理仍在同一笔交易中', explanation: '关闭、重算、退回、争议和证据不会在交易之外形成平行历史。', next: '保留完整关联的最终历史，并进入机构下一项业务。', evidence: '条件、履约、文件、决定和结算的完整链条。', cards: [['结果', '交易发生了什么'], ['异常', '作出了什么决定'], ['依据', '结果基于什么'], ['历史', '审计保留什么']], gekta: '帮助把最终历史整理成清晰说明：发生了什么、结果为什么变化，以及参与方动作基于哪些材料。' },
  ],
};

const ui: Record<Locale, UiCopy> = {
  ru: { label: 'Сделка глазами вашей роли', rolesLabel: 'Выберите роль для просмотра', note: 'Упрощённый публичный пример. Он объясняет логику продукта, не открывает данные и не назначает права — реальные полномочия определяются системой после регистрации и проверки организации.', preview: 'Упрощённый экран рабочего кабинета', deal: 'Одна Сделка · растениеводство', stageLabel: 'Семь этапов одной Сделки', stageContext: 'Контекст этапа', roleLens: 'Что видит эта роль', responsibility: 'Ответственность', next: 'Следующее действие', evidence: 'Основание', money: 'Денежный смысл', gekta: 'Гекта в контексте Сделки', gektaLimit: 'Гекта объясняет и готовит варианты; критическое решение остаётся за уполномоченным участником.' },
  en: { label: 'The Deal from your role', rolesLabel: 'Choose a role to preview', note: 'Simplified public example. It explains product logic, exposes no data and grants no authority; actual permissions are assigned by the system after registration and organisation verification.', preview: 'Simplified workspace screen', deal: 'One Deal · crop production', stageLabel: 'Seven stages of one Deal', stageContext: 'Stage context', roleLens: 'What this role sees', responsibility: 'Responsibility', next: 'Next action', evidence: 'Basis', money: 'Money meaning', gekta: 'Gekta inside the Deal context', gektaLimit: 'Gekta explains and prepares options; critical decisions stay with an authorised participant.' },
  zh: { label: '从你的角色查看交易', rolesLabel: '选择角色查看', note: '这是简化的公开示例，用于说明产品逻辑，不开放数据也不授予权限；真实权限在注册并完成机构核验后由系统确定。', preview: '简化工作空间界面', deal: '一笔交易 · 种植业', stageLabel: '同一笔交易的七个阶段', stageContext: '阶段上下文', roleLens: '该角色看到什么', responsibility: '责任', next: '下一步', evidence: '依据', money: '资金含义', gekta: '交易上下文中的 Gekta', gektaLimit: 'Gekta 负责解释和准备选项；关键决定仍由有权限的参与方作出。' },
};

export function PublicDealRoleScenario({ locale }: { locale: string }) {
  const normalized: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const [role, setRole] = useState<RoleKey>('buyer');
  const [stageIndex, setStageIndex] = useState(0);
  const copy = ui[normalized];
  const selectedRole = useMemo(() => scenarios[normalized][role], [normalized, role]);
  const stageList = stages[normalized];
  const selectedStage = stageList[stageIndex]!;

  const handleRoleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: RoleKey) => {
    const currentIndex = roleKeys.indexOf(key);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight': nextIndex = (currentIndex + 1) % roleKeys.length; break;
      case 'ArrowLeft': nextIndex = (currentIndex - 1 + roleKeys.length) % roleKeys.length; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = roleKeys.length - 1; break;
      default: return;
    }

    event.preventDefault();
    const nextRole = roleKeys[nextIndex]!;
    setRole(nextRole);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  };

  return (
    <div className={styles.root}>
      <div className={styles.heading}><strong>{copy.label}</strong><span>{copy.note}</span></div>
      <section className={styles.workspace} aria-label={copy.preview}>
        <div className={styles.workspaceHeader}>
          <div><small>{copy.preview}</small><strong>{copy.deal}</strong></div>
          <span>{selectedStage.focus}</span>
        </div>

        <div className={styles.stageRail} aria-label={copy.stageLabel}>
          {stageList.map((stage, index) => (
            <button
              key={stage.label}
              type='button'
              className={index === stageIndex ? styles.activeStage : undefined}
              aria-current={index === stageIndex ? 'step' : undefined}
              onClick={() => setStageIndex(index)}
            >
              <i aria-hidden='true' />
              <span><small>{String(index + 1).padStart(2, '0')}</small>{stage.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.stageNarrative} aria-live='polite'>
          <span>{copy.stageContext}</span>
          <strong>{selectedStage.title}</strong>
          <p>{selectedStage.explanation}</p>
        </div>

        <div className={styles.metrics}>
          {selectedStage.cards.map(([label, value], index) => (
            <article key={`${label}-${value}`}>
              {index === 0 ? <MapPinned aria-hidden='true' /> : index === 3 ? <CircleDollarSign aria-hidden='true' /> : <FileCheck2 aria-hidden='true' />}
              <div><span>{label}</span><strong>{value}</strong></div>
            </article>
          ))}
        </div>

        <aside className={styles.gektaCard} aria-label={copy.gekta}>
          <Sparkles aria-hidden='true' />
          <div><span>{copy.gekta}</span><strong>{selectedStage.gekta}</strong><small>{copy.gektaLimit}</small></div>
        </aside>

        <div className={styles.tabs} role='tablist' aria-label={copy.rolesLabel} aria-orientation='horizontal'>
          {roleKeys.map((key) => (
            <button
              key={key}
              id={`public-role-tab-${key}`}
              type='button'
              role='tab'
              aria-selected={role === key}
              aria-controls='public-role-panel'
              tabIndex={role === key ? 0 : -1}
              className={role === key ? styles.active : undefined}
              onClick={() => setRole(key)}
              onKeyDown={(event) => handleRoleTabKeyDown(event, key)}
            >
              {scenarios[normalized][key].label}
            </button>
          ))}
        </div>

        <div id='public-role-panel' className={styles.rolePanel} role='tabpanel' aria-labelledby={`public-role-tab-${role}`} aria-live='polite'>
          <article className={styles.alert}><ShieldAlert aria-hidden='true' /><div><span>{copy.roleLens}</span><strong>{selectedRole.lens}</strong></div></article>
          <div className={styles.actionGrid}>
            <article><UserRoundCheck aria-hidden='true' /><div><span>{copy.responsibility}</span><strong>{selectedRole.responsibility}</strong></div></article>
            <article><FileCheck2 aria-hidden='true' /><div><span>{copy.next}</span><strong>{selectedStage.next}</strong></div></article>
          </div>
          <div className={styles.contextRow}>
            <span><FileCheck2 aria-hidden='true' /><b>{copy.evidence}:</b> {selectedStage.evidence}</span>
            <span><CircleDollarSign aria-hidden='true' /><b>{copy.money}:</b> {selectedRole.money}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
