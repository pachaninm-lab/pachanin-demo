import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export type CabinetDockLocale = 'ru' | 'en' | 'zh';
export type CabinetDockTone = 'work' | 'review' | 'field';
export type CabinetShellFamily = 'operator' | 'role-scoped' | 'field';
export type CabinetSupportTopic =
  | 'deal'
  | 'logistics'
  | 'quality'
  | 'documents'
  | 'payments'
  | 'dispute'
  | 'access'
  | 'technical';

export const ALL_CABINET_ROLES = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
] as const satisfies readonly PlatformRole[];

type RoleCopy = {
  label: string;
  focus: string;
  starter: string;
  supportDomain: string;
};

const ROLE_COPY: Record<CabinetDockLocale, Record<PlatformRole, RoleCopy>> = {
  ru: {
    operator: {
      label: 'Оператор',
      focus: 'управление исполнением сделок',
      starter: 'Какие сделки требуют вмешательства оператора прямо сейчас?',
      supportDomain: 'Исполнение',
    },
    buyer: {
      label: 'Покупатель',
      focus: 'покупка, поставка и оплата',
      starter: 'Что я как покупатель должен сделать прямо сейчас?',
      supportDomain: 'Покупка',
    },
    seller: {
      label: 'Продавец',
      focus: 'продажа, отгрузка и получение оплаты',
      starter: 'Что я как продавец должен сделать прямо сейчас?',
      supportDomain: 'Продажа',
    },
    logistics: {
      label: 'Логистика',
      focus: 'рейсы, водители и прибытие',
      starter: 'Какой рейс требует внимания логиста?',
      supportDomain: 'Рейсы',
    },
    driver: {
      label: 'Водитель',
      focus: 'текущий рейс и следующий шаг',
      starter: 'Какой следующий шаг по моему текущему рейсу?',
      supportDomain: 'Рейс',
    },
    surveyor: {
      label: 'Сюрвейер',
      focus: 'осмотр и подтверждение фактов',
      starter: 'Какие факты или акты мне нужно подтвердить?',
      supportDomain: 'Осмотр',
    },
    elevator: {
      label: 'Элеватор',
      focus: 'приёмка, вес и передача в лабораторию',
      starter: 'Что требует подтверждения по приёмке и весу?',
      supportDomain: 'Приёмка',
    },
    lab: {
      label: 'Лаборатория',
      focus: 'пробы, качество и протокол',
      starter: 'Какие пробы или протоколы требуют моего действия?',
      supportDomain: 'Качество',
    },
    bank: {
      label: 'Банк',
      focus: 'платёжное основание и банковское подтверждение',
      starter: 'Какое платёжное основание ждёт банковской проверки?',
      supportDomain: 'Платежи',
    },
    arbitrator: {
      label: 'Арбитр',
      focus: 'спор, доказательства и решение',
      starter: 'Какой спор требует решения и каких доказательств не хватает?',
      supportDomain: 'Споры',
    },
    compliance: {
      label: 'Комплаенс',
      focus: 'допуск, документы и риски',
      starter: 'Какой допуск или документ сейчас блокирует сделку?',
      supportDomain: 'Допуск',
    },
    executive: {
      label: 'Руководитель',
      focus: 'деньги, блокировки и критические отклонения',
      starter: 'Где сейчас деньги, блокировки и критические отклонения?',
      supportDomain: 'Контроль',
    },
  },
  en: {
    operator: { label: 'Operator', focus: 'deal execution control', starter: 'Which deals require operator intervention right now?', supportDomain: 'Execution' },
    buyer: { label: 'Buyer', focus: 'purchase, delivery and payment', starter: 'What must I do as the buyer right now?', supportDomain: 'Purchase' },
    seller: { label: 'Seller', focus: 'sale, shipment and payment receipt', starter: 'What must I do as the seller right now?', supportDomain: 'Sale' },
    logistics: { label: 'Logistics', focus: 'trips, drivers and arrival', starter: 'Which trip requires logistics attention?', supportDomain: 'Trips' },
    driver: { label: 'Driver', focus: 'current trip and next step', starter: 'What is the next step for my current trip?', supportDomain: 'Trip' },
    surveyor: { label: 'Surveyor', focus: 'inspection and fact confirmation', starter: 'Which facts or reports must I confirm?', supportDomain: 'Inspection' },
    elevator: { label: 'Elevator', focus: 'acceptance, weight and laboratory handoff', starter: 'What requires confirmation for acceptance and weight?', supportDomain: 'Acceptance' },
    lab: { label: 'Laboratory', focus: 'samples, quality and protocol', starter: 'Which samples or protocols require my action?', supportDomain: 'Quality' },
    bank: { label: 'Bank', focus: 'payment basis and bank confirmation', starter: 'Which payment basis is waiting for bank review?', supportDomain: 'Payments' },
    arbitrator: { label: 'Arbitrator', focus: 'dispute, evidence and decision', starter: 'Which dispute requires a decision and what evidence is missing?', supportDomain: 'Disputes' },
    compliance: { label: 'Compliance', focus: 'admission, documents and risks', starter: 'Which admission or document is blocking the deal?', supportDomain: 'Admission' },
    executive: { label: 'Executive', focus: 'money, blockers and critical deviations', starter: 'Where are the money, blockers and critical deviations now?', supportDomain: 'Control' },
  },
  zh: {
    operator: { label: '运营人员', focus: '交易执行管理', starter: '哪些交易现在需要运营人员介入？', supportDomain: '执行' },
    buyer: { label: '买方', focus: '采购、交付与付款', starter: '作为买方，我现在需要做什么？', supportDomain: '采购' },
    seller: { label: '卖方', focus: '销售、发运与收款', starter: '作为卖方，我现在需要做什么？', supportDomain: '销售' },
    logistics: { label: '物流', focus: '运输、司机与到达', starter: '哪一趟运输需要物流人员关注？', supportDomain: '运输' },
    driver: { label: '司机', focus: '当前运输与下一步', starter: '我当前运输的下一步是什么？', supportDomain: '行程' },
    surveyor: { label: '检验员', focus: '检验与事实确认', starter: '我需要确认哪些事实或报告？', supportDomain: '检验' },
    elevator: { label: '粮库', focus: '接收、称重与送检', starter: '接收和称重有哪些事项需要确认？', supportDomain: '接收' },
    lab: { label: '实验室', focus: '取样、质量与报告', starter: '哪些样品或报告需要我处理？', supportDomain: '质量' },
    bank: { label: '银行', focus: '付款依据与银行确认', starter: '哪项付款依据正在等待银行审核？', supportDomain: '付款' },
    arbitrator: { label: '仲裁员', focus: '争议、证据与裁决', starter: '哪项争议需要裁决，还缺少什么证据？', supportDomain: '争议' },
    compliance: { label: '合规', focus: '准入、文件与风险', starter: '哪项准入或文件正在阻断交易？', supportDomain: '准入' },
    executive: { label: '管理者', focus: '资金、阻断与重大偏差', starter: '当前资金、阻断和重大偏差在哪里？', supportDomain: '管控' },
  },
};

const ROLE_META: Record<PlatformRole, {
  tone: CabinetDockTone;
  shellFamily: CabinetShellFamily;
  supportTopic: CabinetSupportTopic;
}> = {
  operator: { tone: 'work', shellFamily: 'operator', supportTopic: 'deal' },
  buyer: { tone: 'work', shellFamily: 'role-scoped', supportTopic: 'deal' },
  seller: { tone: 'work', shellFamily: 'role-scoped', supportTopic: 'deal' },
  logistics: { tone: 'work', shellFamily: 'role-scoped', supportTopic: 'logistics' },
  driver: { tone: 'field', shellFamily: 'field', supportTopic: 'logistics' },
  surveyor: { tone: 'field', shellFamily: 'field', supportTopic: 'quality' },
  elevator: { tone: 'field', shellFamily: 'field', supportTopic: 'quality' },
  lab: { tone: 'field', shellFamily: 'field', supportTopic: 'quality' },
  bank: { tone: 'review', shellFamily: 'role-scoped', supportTopic: 'payments' },
  arbitrator: { tone: 'review', shellFamily: 'role-scoped', supportTopic: 'dispute' },
  compliance: { tone: 'review', shellFamily: 'role-scoped', supportTopic: 'documents' },
  executive: { tone: 'work', shellFamily: 'operator', supportTopic: 'deal' },
};

const COMMON = {
  ru: { assistant: 'ИИ', support: 'Поддержка', call: 'Позвонить', callCaption: 'Связь' },
  en: { assistant: 'AI', support: 'Support', call: 'Call', callCaption: 'Phone' },
  zh: { assistant: 'AI 助手', support: '支持', call: '致电', callCaption: '电话' },
} as const;

export type CabinetContactDockPolicy = ReturnType<typeof getCabinetContactDockPolicy>;

export function getCabinetContactDockPolicy(role: PlatformRole, locale: CabinetDockLocale) {
  const copy = ROLE_COPY[locale][role];
  const common = COMMON[locale];
  const meta = ROLE_META[role];

  const groupLabel = locale === 'ru'
    ? `Связь и помощь — кабинет «${copy.label}»`
    : locale === 'en'
      ? `Help and contact — ${copy.label} workspace`
      : `帮助与联系 — ${copy.label}工作区`;

  const assistantAria = locale === 'ru'
    ? `Открыть ИИ-помощника кабинета «${copy.label}»: ${copy.focus}`
    : locale === 'en'
      ? `Open the ${copy.label} workspace AI assistant: ${copy.focus}`
      : `打开${copy.label}工作区 AI 助手：${copy.focus}`;

  const supportAria = locale === 'ru'
    ? `Открыть поддержку кабинета «${copy.label}» по контуру «${copy.supportDomain}»`
    : locale === 'en'
      ? `Open ${copy.label} workspace support for ${copy.supportDomain}`
      : `打开${copy.label}工作区支持：${copy.supportDomain}`;

  const callAria = locale === 'ru'
    ? `Позвонить в поддержку кабинета «${copy.label}»`
    : locale === 'en'
      ? `Call support for the ${copy.label} workspace`
      : `致电${copy.label}工作区支持`;

  return {
    role,
    roleLabel: copy.label,
    roleFocus: copy.focus,
    assistantStarter: copy.starter,
    supportDomain: copy.supportDomain,
    assistantLabel: common.assistant,
    supportLabel: common.support,
    callLabel: common.call,
    callCaption: common.callCaption,
    groupLabel,
    assistantAria,
    supportAria,
    callAria,
    tone: meta.tone,
    shellFamily: meta.shellFamily,
    supportTopic: meta.supportTopic,
  } as const;
}
