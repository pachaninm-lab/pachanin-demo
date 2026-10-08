import { isAppLocale, type AppLocale } from '@/i18n/locale';
import type { TourStage } from '@/lib/platform-v7/public-product-experience-state';

export const DEAL_JOURNEY_INTENTS = ['sell', 'buy', 'transport', 'receive', 'settle', 'control'] as const;
export type DealJourneyIntent = (typeof DEAL_JOURNEY_INTENTS)[number];

const ruStageActions: Record<TourStage, string> = {
  terms: 'Сохраняет согласованные коммерческие условия и их версию в контексте одной Сделки.',
  admission: 'Проверяет допуск организации и полномочия участника до разрешения следующих действий.',
  auction: 'Фиксирует ставки, историю торгов и результат выбора без возможности незаметно переписать ход аукциона.',
  deal: 'Связывает результат выбора с одной Сделкой и фиксирует основание дальнейшего исполнения.',
  logistics: 'Связывает рейс, перевозчика, водителя и транспортные документы со Сделкой.',
  acceptance: 'Фиксирует фактическую приёмку, вес и обнаруженные отклонения в контексте Сделки.',
  laboratory: 'Связывает лабораторный результат с условиями Сделки и определяет влияние отклонений.',
  documents: 'Проверяет комплектность, версии и связи документов перед расчётным этапом.',
  settlement: 'Проверяет наступление оснований для расчёта и фиксирует доступные события финансового контура.',
  closure: 'Собирает хронологию, документы и подтверждения в доказательный контур закрытой Сделки.',
};

const enStageActions: Record<TourStage, string> = {
  terms: 'Keeps the agreed commercial terms and their version in the context of one Deal.',
  admission: 'Checks organisation admission and participant authority before subsequent actions are allowed.',
  auction: 'Records bids, trading history and the selection result without silently rewriting auction history.',
  deal: 'Links the selection result to one Deal and records the basis for further execution.',
  logistics: 'Links the trip, carrier, driver and transport documents to the Deal.',
  acceptance: 'Records actual acceptance, weight and detected deviations in the Deal context.',
  laboratory: 'Links the laboratory result to Deal terms and determines the effect of deviations.',
  documents: 'Checks completeness, versions and document relationships before the settlement stage.',
  settlement: 'Checks whether settlement grounds have arisen and records available financial-circuit events.',
  closure: 'Assembles chronology, documents and confirmations into the evidence contour of the closed Deal.',
};

const zhStageActions: Record<TourStage, string> = {
  terms: '在同一笔交易上下文中保存已确认的商业条件及其版本。',
  admission: '在允许后续操作前核验组织准入和参与方权限。',
  auction: '记录报价、交易历史和选择结果，防止交易过程被静默改写。',
  deal: '将选择结果绑定到一笔交易，并记录后续履约的依据。',
  logistics: '将运输任务、承运方、司机和运输文件绑定到交易。',
  acceptance: '在交易上下文中记录实际收货、重量和发现的偏差。',
  laboratory: '将实验室结果与交易条件关联，并判断偏差影响。',
  documents: '在结算阶段前检查文件完整性、版本和关联关系。',
  settlement: '检查结算依据是否成立，并记录可用的金融闭环事件。',
  closure: '将时间线、文件和确认信息汇总为已关闭交易的证据链。',
};

const copy = {
  ru: {
    intro: {
      kicker: 'Как работает Сделка',
      title: 'Посмотрите обычный путь Сделки от условий до закрытия',
      lead: 'Выберите свою задачу или роль. Сначала платформа показывает нормальное исполнение, а отклонение или спор открываются отдельным сценарием только при необходимости.',
      demoNotice: 'Ниже используется вымышленный пример. Он не содержит реальных сделок или организаций, не выполняет банковские операции и не имитирует ответы внешних систем.',
      backHome: 'На главную',
      connect: 'Зарегистрироваться',
    },
    labels: {
      intentQuestion: 'Что вы хотите сделать?',
      intentLead: 'Выберите ближайшую рабочую задачу — системные права от этого не меняются.',
      otherParticipant: 'Другой участник Сделки',
      chooseParticipant: 'Выберите участника',
      changeIntent: 'Изменить задачу',
      quickMode: 'Быстро посмотреть',
      detailedMode: 'Изучить подробно',
      quickModeNote: 'Платформа проводит по ключевым этапам и показывает то, что важно выбранной роли сейчас.',
      detailedModeNote: 'Подробные этапы, документы, расчётные основания, риски и роли одной Сделки.',
      scenarioQuestion: 'Что происходит в этой Сделке?',
      formalScenario: 'Сценарий исполнения',
      yourDeal: 'Пример Сделки',
      demonstration: 'Вымышленный пример',
      stage: 'Этап',
      of: 'из',
      whatHappened: 'Что произошло',
      yourAction: 'Что требуется от вас',
      noAction: 'Сейчас от вас действий не требуется.',
      platformAction: 'Что делает платформа',
      nowActs: 'Сейчас действует',
      money: 'Деньги',
      documents: 'Документы',
      risk: 'Риск',
      next: 'Дальше',
      askTai: 'Спросить Гекту об этом этапе',
      startQuick: 'Начать быстрый показ',
      pause: 'Пауза',
      continue: 'Продолжить',
      stop: 'Остановить',
      restart: 'Показать с начала',
      previous: 'Назад',
      nextStage: 'Следующий этап',
      detailedOpen: 'Открыть подробный разбор',
      detailedBack: 'Вернуться к быстрому просмотру',
      completeTitle: 'Сделка завершена',
      completeLead: 'Обычный путь Сделки завершён в одном цифровом контуре.',
      oneContour: 'Одна Сделка связывает исполнение, документы, расчётные основания, риски и доказательства.',
      anotherScenario: 'Посмотреть другой сценарий',
      beforeTitle: 'Без единого цифрового контура',
      afterTitle: 'В «Прозрачной Цене»',
      roleContext: 'Ваш контекст',
      scenarioRiskNone: 'Критических отклонений в сценарии нет.',
    },
    intents: {
      sell: { label: 'Продать продукцию', description: 'Увидеть путь от условий продажи до поставки, документов и расчёта.', perspective: 'seller' },
      buy: { label: 'Купить продукцию', description: 'Проверить исполнение поставки, качество, документы и основания расчёта.', perspective: 'buyer' },
      transport: { label: 'Организовать перевозку', description: 'Понять задачи перевозчика, водителя и транспортных документов.', perspective: 'logistics' },
      receive: { label: 'Принять и проверить груз', description: 'Увидеть приёмку, вес, лабораторию и подтверждение качества.', perspective: 'elevator' },
      settle: { label: 'Проверить основания расчёта', description: 'Понять, какие подтверждённые события и документы создают основание финансового действия.', perspective: 'bank' },
      control: { label: 'Контролировать исполнение', description: 'Посмотреть Сделку, сроки, исключения, риски и доказательную историю.', perspective: 'operator' },
    },
    scenarios: {
      standard: { label: 'Всё прошло нормально', risk: 'Критических отклонений нет: Сделка движется по обычному пути.' },
      partial: { label: 'Приняли не весь объём', risk: 'Фактический принятый объём может изменить расчётное основание.' },
      dispute: { label: 'Качество не совпало', risk: 'Расчёт может быть остановлен до фиксации доказательств и решения по отклонению.' },
    },
    platformActionByStage: ruStageActions,
    moneyByStage: {
      terms: 'Расчётное основание ещё не сформировано.',
      admission: 'Денежный этап недоступен до допуска участников.',
      auction: 'Цена определяется; расчётное основание ещё не сформировано.',
      deal: 'Условия Сделки зафиксированы; формируются основания исполнения.',
      logistics: 'Выплата не разрешена: исполнение поставки ещё продолжается.',
      acceptance: 'Выплата не разрешена: ожидается подтверждение фактической приёмки.',
      laboratory: 'Выплата не разрешена до результата качества и проверки отклонений.',
      documents: 'Выплата не разрешена до подтверждения комплектности требуемых документов.',
      settlement: 'Показано наступление расчётных оснований; реальная банковская операция в публичном примере не выполняется.',
      closure: 'Расчётный этап примера закрыт; реальная выплата здесь не выполнялась.',
    },
    documentsByStage: {
      terms: 'Коммерческие условия',
      admission: 'Основания допуска и полномочий',
      auction: 'История ставок и результат выбора',
      deal: 'Основание Сделки',
      logistics: 'Транспортные документы',
      acceptance: 'Акт приёмки',
      laboratory: 'Лабораторный протокол',
      documents: 'Комплект документов Сделки',
      settlement: 'Расчётные основания',
      closure: 'Доказательный пакет',
    },
    taiPrompts: {
      terms: ['Что именно фиксируется в условиях Сделки?', 'Что будет, если стороны изменят условия?', 'Почему следующий этап ещё недоступен?'],
      admission: ['Что проверяется при допуске?', 'Почему роль нельзя выбрать самостоятельно?', 'Что блокирует переход к торгам?'],
      auction: ['Как фиксируется история ставок?', 'Как выбирается победитель?', 'Что не позволяет нарушить правила торгов?'],
      deal: ['Что становится основанием Сделки?', 'Какие данные связываются после выбора стороны?', 'Что дальше происходит с расчётными основаниями?'],
      logistics: ['Что должен сделать перевозчик?', 'Какие транспортные данные связываются со Сделкой?', 'Что будет при задержке рейса?'],
      acceptance: ['Почему фактический вес важен?', 'Что будет при расхождении объёма?', 'Какие документы возникают при приёмке?'],
      laboratory: ['Что будет при отклонении качества?', 'Как лабораторный результат влияет на расчёт?', 'Какие доказательства сохраняются?'],
      documents: ['Какие документы ещё нужны?', 'Как контролируются версии документов?', 'Почему расчёт пока может быть заблокирован?'],
      settlement: ['Почему денежное действие можно или нельзя продолжить?', 'Какие события создают основание для расчёта?', 'Что подтверждает внешний финансовый контур?'],
      closure: ['Что входит в доказательный пакет?', 'Какая история остаётся после закрытия?', 'Что может использоваться при последующем споре?'],
    },
    finalChecks: ['Поставка и ключевые события связаны со Сделкой', 'Документы собраны в едином контексте', 'Расчётные основания проверены', 'Отклонения и решения остаются в хронологии', 'Доказательная история сохранена'],
    before: ['Договор отдельно', 'Перевозка отдельно', 'Лаборатория отдельно', 'Документы отдельно', 'Расчёт отдельно', 'Спор собирается вручную'],
    after: ['Одна Сделка связывает участников и события', 'Каждый этап имеет ответственного и следующий шаг', 'Документы связаны с событиями исполнения', 'Деньги зависят от подтверждённых оснований', 'Отклонения переходят в доказательный контур', 'Гекта объясняет факты, риск и следующий шаг'],
  },
  en: {
    intro: {
      kicker: 'How a Deal works',
      title: 'See the ordinary Deal journey from terms to closure',
      lead: 'Choose your task or role. The platform shows normal execution first; deviation or dispute is a separate scenario only when needed.',
      demoNotice: 'The flow uses fictional data. It contains no real deals or organisations, performs no banking operation and does not simulate responses from external systems.',
      backHome: 'Back to home',
      connect: 'Register',
    },
    labels: {
      intentQuestion: 'What do you want to do?', intentLead: 'Choose the closest work task — this never changes system permissions.', otherParticipant: 'Another Deal participant', chooseParticipant: 'Choose a participant', changeIntent: 'Change task', quickMode: 'Quick view', detailedMode: 'Explore in detail', quickModeNote: 'The platform walks through key stages and shows what matters to the selected role now.', detailedModeNote: 'Detailed stages, documents, settlement grounds, risks and roles of one Deal.', scenarioQuestion: 'What happens in this Deal?', formalScenario: 'Execution scenario', yourDeal: 'Example Deal', demonstration: 'Fictional example', stage: 'Stage', of: 'of', whatHappened: 'What happened', yourAction: 'What you need to do', noAction: 'No action is required from you right now.', platformAction: 'What the platform does', nowActs: 'Acting now', money: 'Money', documents: 'Documents', risk: 'Risk', next: 'Next', askTai: 'Ask Gekta about this stage', startQuick: 'Start quick walkthrough', pause: 'Pause', continue: 'Continue', stop: 'Stop', restart: 'Start from the beginning', previous: 'Back', nextStage: 'Next stage', detailedOpen: 'Open detailed review', detailedBack: 'Return to quick view', completeTitle: 'Deal completed', completeLead: 'The ordinary Deal journey is complete in one digital contour.', oneContour: 'One Deal connects execution, documents, settlement grounds, risks and evidence.', anotherScenario: 'View another scenario', beforeTitle: 'Without one digital contour', afterTitle: 'With Transparent Price', roleContext: 'Your context', scenarioRiskNone: 'No critical deviations in this scenario.'
    },
    intents: {
      sell: { label: 'Sell produce', description: 'See the path from sale terms to delivery, documents and settlement.', perspective: 'seller' }, buy: { label: 'Buy produce', description: 'Check delivery execution, quality, documents and settlement grounds.', perspective: 'buyer' }, transport: { label: 'Organise transport', description: 'Understand carrier, driver and transport-document tasks.', perspective: 'logistics' }, receive: { label: 'Receive and inspect cargo', description: 'See acceptance, weight, laboratory checks and quality confirmation.', perspective: 'elevator' }, settle: { label: 'Review settlement grounds', description: 'Understand which confirmed events and documents form the financial-action basis.', perspective: 'bank' }, control: { label: 'Control execution', description: 'Review the Deal, deadlines, exceptions, risks and evidence history.', perspective: 'operator' }
    },
    scenarios: {
      standard: { label: 'Everything went normally', risk: 'No critical deviations: the Deal follows the ordinary path.' }, partial: { label: 'Not all volume was accepted', risk: 'The actually accepted volume may change the settlement basis.' }, dispute: { label: 'Quality did not match', risk: 'Settlement may be held until evidence and a deviation decision are recorded.' }
    },
    platformActionByStage: enStageActions,
    moneyByStage: {
      terms: 'Settlement grounds have not yet been formed.', admission: 'The money stage is unavailable until participant admission.', auction: 'Price is being determined; settlement grounds do not yet exist.', deal: 'Deal terms are fixed and execution grounds are being formed.', logistics: 'Release is not allowed while delivery execution continues.', acceptance: 'Release is not allowed while actual acceptance remains unconfirmed.', laboratory: 'Release is not allowed until quality results and deviations are checked.', documents: 'Release is not allowed until the required document set is confirmed.', settlement: 'Settlement grounds are shown as reached; no real banking operation is performed in the public example.', closure: 'The example settlement stage is closed; no real payout was performed here.'
    },
    documentsByStage: { terms: 'Commercial terms', admission: 'Admission and authority grounds', auction: 'Bid history and selection result', deal: 'Deal basis', logistics: 'Transport documents', acceptance: 'Acceptance act', laboratory: 'Laboratory protocol', documents: 'Deal document set', settlement: 'Settlement grounds', closure: 'Evidence pack' },
    taiPrompts: {
      terms: ['What is fixed in the Deal terms?', 'What happens if the parties change the terms?', 'Why is the next stage not available yet?'], admission: ['What is checked during admission?', 'Why can a role not be self-selected?', 'What blocks the move to trading?'], auction: ['How is bid history recorded?', 'How is the winner selected?', 'What prevents trading rules from being broken?'], deal: ['What becomes the Deal basis?', 'Which data is linked after the counterparty is selected?', 'What happens to settlement grounds next?'], logistics: ['What must the carrier do?', 'Which transport data is linked to the Deal?', 'What happens if the trip is delayed?'], acceptance: ['Why does actual weight matter?', 'What happens if volume differs?', 'Which documents arise at acceptance?'], laboratory: ['What happens if quality deviates?', 'How does the laboratory result affect settlement?', 'Which evidence is retained?'], documents: ['Which documents are still required?', 'How are document versions controlled?', 'Why can settlement still be blocked?'], settlement: ['Why can or cannot a money action continue?', 'Which events create settlement grounds?', 'What confirms the external financial circuit?'], closure: ['What enters the evidence pack?', 'Which history remains after closure?', 'What can be used in a later dispute?']
    },
    finalChecks: ['Delivery and key events are linked to the Deal', 'Documents are assembled in one context', 'Settlement grounds are checked', 'Deviations and decisions remain in chronology', 'Evidence history is retained'],
    before: ['Contract separate', 'Transport separate', 'Laboratory separate', 'Documents separate', 'Settlement separate', 'Dispute evidence assembled manually'],
    after: ['One Deal connects participants and events', 'Every stage has an owner and next step', 'Documents are linked to execution events', 'Money depends on confirmed grounds', 'Deviations enter the evidence contour', 'Gekta explains facts, risk and the next action'],
  },
  zh: {
    intro: {
      kicker: '交易如何运行', title: '查看从条件到关闭的普通交易路径', lead: '选择你的任务或角色。平台先展示正常履约；只有在确有需要时，才进入偏差或争议场景。', demoNotice: '下方使用虚构数据，不包含真实交易或机构，不执行真实银行操作，也不模拟外部系统的响应。', backHome: '返回首页', connect: '注册'
    },
    labels: {
      intentQuestion: '你想做什么？', intentLead: '请选择最接近的工作任务；该选择不会改变系统权限。', otherParticipant: '其他交易参与方', chooseParticipant: '选择参与方', changeIntent: '更换任务', quickMode: '快速查看', detailedMode: '详细查看', quickModeNote: '平台带你经过关键阶段，只展示当前与所选角色最相关的信息。', detailedModeNote: '查看同一笔交易的详细阶段、文件、结算依据、风险和角色。', scenarioQuestion: '这笔交易发生什么情况？', formalScenario: '履约场景', yourDeal: '示例交易', demonstration: '虚构示例', stage: '阶段', of: '/', whatHappened: '发生了什么', yourAction: '你需要做什么', noAction: '当前不需要你执行操作。', platformAction: '平台做什么', nowActs: '当前执行方', money: '资金', documents: '文件', risk: '风险', next: '下一步', askTai: '向 Gekta 询问当前阶段', startQuick: '开始快速查看', pause: '暂停', continue: '继续', stop: '停止', restart: '从头开始', previous: '返回', nextStage: '下一阶段', detailedOpen: '打开详细解析', detailedBack: '返回快速查看', completeTitle: '交易已完成', completeLead: '普通交易路径已在同一个数字闭环中完成。', oneContour: '一笔交易连接履约、文件、结算依据、风险和证据。', anotherScenario: '查看其他场景', beforeTitle: '没有统一数字闭环', afterTitle: '使用“透明价格”', roleContext: '你的上下文', scenarioRiskNone: '当前场景没有重大偏差。'
    },
    intents: {
      sell: { label: '出售农产品', description: '查看从销售条件到交付、文件和结算的路径。', perspective: 'seller' }, buy: { label: '购买农产品', description: '检查交付履约、质量、文件和结算依据。', perspective: 'buyer' }, transport: { label: '组织运输', description: '了解承运方、司机和运输文件的任务。', perspective: 'logistics' }, receive: { label: '收货并检查', description: '查看收货、重量、实验室和质量确认过程。', perspective: 'elevator' }, settle: { label: '检查结算依据', description: '了解哪些已确认事件和文件形成金融操作依据。', perspective: 'bank' }, control: { label: '控制履约', description: '查看整笔交易、期限、异常、风险和证据历史。', perspective: 'operator' }
    },
    scenarios: {
      standard: { label: '一切正常', risk: '没有重大偏差，交易按普通路径推进。' }, partial: { label: '未全部收货', risk: '实际收货量可能改变结算依据。' }, dispute: { label: '质量不一致', risk: '在证据和偏差处理决定记录前，结算可能被暂停。' }
    },
    platformActionByStage: zhStageActions,
    moneyByStage: {
      terms: '尚未形成结算依据。', admission: '参与方完成准入前，资金阶段不可用。', auction: '正在确定价格，尚未形成结算依据。', deal: '交易条件已固定，正在形成履约依据。', logistics: '交付仍在执行，暂不允许资金释放。', acceptance: '实际收货未确认前，暂不允许资金释放。', laboratory: '质量结果和偏差检查完成前，暂不允许资金释放。', documents: '所需文件集确认完整前，暂不允许资金释放。', settlement: '示例中已形成结算依据；公开页面不执行真实银行操作。', closure: '示例结算阶段已关闭；此处未执行真实付款。'
    },
    documentsByStage: { terms: '商业条件', admission: '准入与权限依据', auction: '报价历史和选择结果', deal: '交易依据', logistics: '运输文件', acceptance: '收货单', laboratory: '实验室报告', documents: '交易文件集', settlement: '结算依据', closure: '证据包' },
    taiPrompts: {
      terms: ['交易条件具体固定了什么？', '双方修改条件会发生什么？', '为什么下一阶段尚不可用？'], admission: ['准入时检查什么？', '为什么不能自行选择角色？', '什么会阻塞进入交易？'], auction: ['报价历史如何记录？', '如何选择获胜方？', '什么机制防止违反交易规则？'], deal: ['什么构成交易依据？', '选择交易方后会关联哪些数据？', '结算依据下一步会怎样？'], logistics: ['承运方需要做什么？', '哪些运输数据会绑定到交易？', '运输延误会怎样？'], acceptance: ['为什么实际重量重要？', '数量不一致会怎样？', '收货阶段形成哪些文件？'], laboratory: ['质量偏差会怎样？', '实验室结果如何影响结算？', '会保留哪些证据？'], documents: ['还需要哪些文件？', '如何控制文件版本？', '为什么结算仍可能被阻塞？'], settlement: ['为什么资金操作可以或不可以继续？', '哪些事件形成结算依据？', '外部金融闭环由什么确认？'], closure: ['证据包包含什么？', '关闭后保留哪些历史？', '后续争议可使用什么？']
    },
    finalChecks: ['交付和关键事件与交易关联', '文件汇总在统一上下文', '结算依据已检查', '偏差和决定保留在时间线', '证据历史已保存'],
    before: ['合同独立存在', '运输独立存在', '实验室独立存在', '文件独立存在', '结算独立存在', '争议证据需手工汇总'],
    after: ['一笔交易连接参与方和事件', '每个阶段都有责任方和下一步', '文件与履约事件绑定', '资金取决于已确认依据', '偏差进入证据闭环', 'Gekta 解释事实、风险和下一步'],
  },
} as const;

export type PublicDealJourneyV5Copy = (typeof copy)[AppLocale];

export function getPublicDealJourneyV5Copy(locale: string): PublicDealJourneyV5Copy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return copy[resolved];
}
