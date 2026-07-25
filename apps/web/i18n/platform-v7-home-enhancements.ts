export type HomeRoleEntryCopy = {
  key: 'seller' | 'buyer' | 'operator' | 'finance';
  title: string;
  text: string;
  result: string;
  cta: string;
  stage: 'logistics' | 'acceptance' | 'settlement';
  lens: 'execution' | 'money';
  perspective: 'seller' | 'buyer' | 'operator' | 'bank';
};

export type HomeEnhancementCopy = {
  nav: {
    participants: string;
    tai: string;
  };
  heroTai: {
    name: string;
    text: string;
    cta: string;
  };
  roles: {
    eyebrow: string;
    title: string;
    lead: string;
    note: string;
    items: readonly HomeRoleEntryCopy[];
  };
  tai: {
    eyebrow: string;
    title: string;
    lead: string;
    definitionLabel: string;
    definition: string;
    impactLabel: string;
    impact: string;
    workflowTitle: string;
    workflow: readonly {
      index: string;
      title: string;
      text: string;
    }[];
  };
};

const ru: HomeEnhancementCopy = {
  nav: {
    participants: 'Участникам',
    tai: 'TAI',
  },
  heroTai: {
    name: 'TAI — Transparent Agro Intelligence',
    text: 'Операционный интеллект «Прозрачной Цены»: понимает контекст Сделки, выявляет блокеры и риск для сроков и денег, объясняет основание и готовит следующее действие.',
    cta: 'Разобрать TAI',
  },
  roles: {
    eyebrow: 'Вход по задаче',
    title: 'Сразу откройте Сделку в своём контексте',
    lead: 'Четыре публичных ракурса показывают один и тот же процесс с точки зрения решения, которое нужно принять сейчас.',
    note: 'Это публичный сценарий. Выбор ракурса не меняет роль, права или доступ к данным.',
    items: [
      {
        key: 'seller',
        title: 'Продавец',
        text: 'Контролируйте исполнение обязательств, качество, документы и основание для получения денег.',
        result: 'Главный вопрос: что мешает закрыть поставку и получить расчёт?',
        cta: 'Открыть ракурс продавца',
        stage: 'logistics',
        lens: 'execution',
        perspective: 'seller',
      },
      {
        key: 'buyer',
        title: 'Покупатель',
        text: 'Проверяйте приёмку, качество, отклонения, документы и готовность к расчёту.',
        result: 'Главный вопрос: можно ли принять товар на согласованных условиях?',
        cta: 'Открыть ракурс покупателя',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'buyer',
      },
      {
        key: 'operator',
        title: 'Оператор исполнения',
        text: 'Видьте этап, блокер, ответственного, дедлайн и следующее действие по всей Сделке.',
        result: 'Главный вопрос: кто и что должен сделать, чтобы процесс продолжился?',
        cta: 'Открыть ракурс оператора',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'operator',
      },
      {
        key: 'finance',
        title: 'Финансы и контроль',
        text: 'Проверяйте резерв, основание выплаты, расхождения, сверку и денежный риск.',
        result: 'Главный вопрос: можно ли безопасно перейти к выплате?',
        cta: 'Открыть денежный ракурс',
        stage: 'settlement',
        lens: 'money',
        perspective: 'bank',
      },
    ],
  },
  tai: {
    eyebrow: 'TAI · Transparent Agro Intelligence',
    title: 'Операционный интеллект внутри каждой Сделки',
    lead: 'TAI — не отдельный чат и не декоративный помощник. Он работает в контексте Сделки: связывает события, документы, роли и правила, чтобы участник быстрее принял проверяемое решение.',
    definitionLabel: 'Для чего нужен TAI',
    definition: 'Чтобы за несколько секунд понять, что произошло, почему процесс остановился, как это влияет на сроки и деньги, на каком основании сделан вывод и какое действие требуется дальше.',
    impactLabel: 'Влияние на Сделку',
    impact: 'Окончательная выплата остаётся остановленной до подтверждения акта расхождений и договорного правила перерасчёта.',
    workflowTitle: 'Как TAI формирует ответ',
    workflow: [
      {
        index: '01',
        title: 'Понимает контекст',
        text: 'Связывает этап, роль, события, документы и правила конкретной Сделки.',
      },
      {
        index: '02',
        title: 'Находит отклонение',
        text: 'Выявляет блокер и оценивает влияние на срок, деньги и риск спора.',
      },
      {
        index: '03',
        title: 'Показывает основание',
        text: 'Указывает источник, актуальность контекста и надёжность вывода.',
      },
      {
        index: '04',
        title: 'Готовит действие',
        text: 'Формирует следующий шаг или проект документа для подтверждения человеком.',
      },
    ],
  },
};

const en: HomeEnhancementCopy = {
  nav: {
    participants: 'Participants',
    tai: 'TAI',
  },
  heroTai: {
    name: 'TAI — Transparent Agro Intelligence',
    text: 'Transparent Price operational intelligence: it understands Deal context, detects blockers and schedule or monetary risk, explains the evidence and prepares the next action.',
    cta: 'Explore TAI',
  },
  roles: {
    eyebrow: 'Enter by task',
    title: 'Open the Deal in your operating context',
    lead: 'Four public perspectives show the same process through the decision that must be made now.',
    note: 'This is a public scenario. Selecting a perspective does not change roles, permissions or data access.',
    items: [
      {
        key: 'seller',
        title: 'Seller',
        text: 'Control obligations, quality, documents and the basis for receiving funds.',
        result: 'Key question: what prevents delivery closure and settlement?',
        cta: 'Open seller perspective',
        stage: 'logistics',
        lens: 'execution',
        perspective: 'seller',
      },
      {
        key: 'buyer',
        title: 'Buyer',
        text: 'Review acceptance, quality, deviations, documents and settlement readiness.',
        result: 'Key question: can the product be accepted on the agreed terms?',
        cta: 'Open buyer perspective',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'buyer',
      },
      {
        key: 'operator',
        title: 'Execution operator',
        text: 'See the stage, blocker, owner, deadline and next action across the Deal.',
        result: 'Key question: who must do what for execution to continue?',
        cta: 'Open operator perspective',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'operator',
      },
      {
        key: 'finance',
        title: 'Finance and control',
        text: 'Review reserve, payout basis, discrepancies, reconciliation and monetary risk.',
        result: 'Key question: is it safe to proceed to payout?',
        cta: 'Open money perspective',
        stage: 'settlement',
        lens: 'money',
        perspective: 'bank',
      },
    ],
  },
  tai: {
    eyebrow: 'TAI · Transparent Agro Intelligence',
    title: 'Operational intelligence inside every Deal',
    lead: 'TAI is not a separate chat or a decorative assistant. It works in Deal context, connecting events, documents, roles and rules so participants can make faster, verifiable decisions.',
    definitionLabel: 'What TAI is for',
    definition: 'To explain in seconds what happened, why execution stopped, how it affects time and money, what evidence supports the conclusion and which action comes next.',
    impactLabel: 'Deal impact',
    impact: 'Final payout remains paused until the discrepancy act and contractual recalculation rule are confirmed.',
    workflowTitle: 'How TAI builds an answer',
    workflow: [
      {
        index: '01',
        title: 'Understands context',
        text: 'Connects the stage, role, events, documents and rules of the specific Deal.',
      },
      {
        index: '02',
        title: 'Detects deviation',
        text: 'Finds the blocker and assesses schedule, money and dispute risk.',
      },
      {
        index: '03',
        title: 'Shows evidence',
        text: 'States the source, context freshness and confidence of the conclusion.',
      },
      {
        index: '04',
        title: 'Prepares action',
        text: 'Creates the next step or a document draft for human confirmation.',
      },
    ],
  },
};

const zh: HomeEnhancementCopy = {
  nav: {
    participants: '参与方',
    tai: 'TAI',
  },
  heroTai: {
    name: 'TAI — Transparent Agro Intelligence',
    text: '“透明价格”的运营智能：理解交易上下文，识别阻塞项以及进度和资金风险，说明依据并准备下一步行动。',
    cta: '了解 TAI',
  },
  roles: {
    eyebrow: '按任务进入',
    title: '从你的运营视角打开交易',
    lead: '四个公开视角展示同一流程，以及当前必须作出的决定。',
    note: '这是公开场景。选择视角不会改变角色、权限或数据访问范围。',
    items: [
      {
        key: 'seller',
        title: '卖方',
        text: '控制履约、质量、文件以及收款依据。',
        result: '核心问题：什么阻碍交付关闭和结算？',
        cta: '打开卖方视角',
        stage: 'logistics',
        lens: 'execution',
        perspective: 'seller',
      },
      {
        key: 'buyer',
        title: '买方',
        text: '检查验收、质量、偏差、文件与结算准备度。',
        result: '核心问题：能否按约定条件接收商品？',
        cta: '打开买方视角',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'buyer',
      },
      {
        key: 'operator',
        title: '执行运营方',
        text: '查看交易阶段、阻塞项、责任方、截止时间与下一步。',
        result: '核心问题：谁必须完成什么，流程才能继续？',
        cta: '打开运营方视角',
        stage: 'acceptance',
        lens: 'execution',
        perspective: 'operator',
      },
      {
        key: 'finance',
        title: '财务与控制',
        text: '检查资金预留、付款依据、差异、对账与资金风险。',
        result: '核心问题：现在进入付款是否安全？',
        cta: '打开资金视角',
        stage: 'settlement',
        lens: 'money',
        perspective: 'bank',
      },
    ],
  },
  tai: {
    eyebrow: 'TAI · Transparent Agro Intelligence',
    title: '每笔交易内部的运营智能',
    lead: 'TAI 不是独立聊天窗口，也不是装饰性助手。它在交易上下文中连接事件、文件、角色与规则，帮助参与方更快作出可核验决策。',
    definitionLabel: 'TAI 的用途',
    definition: '在数秒内说明发生了什么、流程为何停止、对时间与资金有什么影响、结论依据是什么，以及下一步需要采取什么行动。',
    impactLabel: '对交易的影响',
    impact: '在差异单和合同重算规则确认之前，最终付款保持暂停。',
    workflowTitle: 'TAI 如何形成答案',
    workflow: [
      {
        index: '01',
        title: '理解上下文',
        text: '连接具体交易的阶段、角色、事件、文件与规则。',
      },
      {
        index: '02',
        title: '识别偏差',
        text: '发现阻塞项并评估进度、资金与争议风险。',
      },
      {
        index: '03',
        title: '展示依据',
        text: '标明来源、上下文时效性与结论可靠度。',
      },
      {
        index: '04',
        title: '准备行动',
        text: '生成人工确认所需的下一步或文件草稿。',
      },
    ],
  },
};

export function getPlatformV7HomeEnhancementCopy(locale: string): HomeEnhancementCopy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
