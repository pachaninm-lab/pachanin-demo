import { getPlatformV7HomeStoryCopy as getBaseStoryCopy } from './platform-v7-home-story';

const COPY = {
  ru: {
    nav: 'Гекта',
    proof: { label: 'Гекта внутри процесса', text: 'Аграрный интеллект находит отклонение, но не подменяет полномочия' },
    comparison: 'Гекта анализирует конкретную Сделку, источники и ролевые ограничения.',
    control: 'Гекта, аналитика, API, ERP/1С, логистика, лаборатория и финансы.',
    deviationEvent: 'Гекта сопоставила условия',
    deviationBoundary: 'Гекта не меняет договор и не разрешает расчёт самостоятельно.',
    confidenceLabel: 'Уверенность Гекты',
    abstentionEvent: 'Гекта воздержалась от вывода',
    tai: {
      eyebrow: 'Гекта · аграрный интеллект',
      title: 'Гекта — интеллектуальный слой конкретной Сделки',
      lead: 'Она понимает роли, этапы, документы и правила платформы. Ответ разделяет факт, вывод, риск и недостающие данные.',
      analysisLabel: 'Гекта · анализ Сделки',
      limit: 'Граница: Гекта не определяет качество вместо лаборатории, не меняет договор, не разрешает платёж и не выносит юридическое решение.',
      cta: 'Посмотреть Гекту подробнее',
    },
    authority: 'Гекта и внешняя система не действуют вместо участника.',
    laboratory: 'Гекта не заменяет измерение и подпись лаборатории',
    finalDecision: 'Только уполномоченный участник или подключённая система в пределах согласованного сценария. Гекта объясняет, но не подменяет полномочия.',
  },
  en: {
    nav: 'Gekta',
    proof: { label: 'Gekta in the process', text: 'Agricultural intelligence finds deviations without taking over authority' },
    comparison: 'Gekta analyses a specific Deal, its sources and role constraints.',
    control: 'Gekta, analytics, API, ERP/1C, logistics, laboratories and finance.',
    deviationEvent: 'Gekta matched the terms',
    deviationBoundary: 'Gekta does not change the contract or authorise settlement by itself.',
    confidenceLabel: 'Gekta confidence',
    abstentionEvent: 'Gekta abstained',
    tai: {
      eyebrow: 'Gekta · agricultural intelligence',
      title: 'Gekta is the intelligence layer of a specific Deal',
      lead: 'It understands platform roles, stages, documents and rules. Its answer separates facts, conclusions, risks and missing data.',
      analysisLabel: 'Gekta · Deal analysis',
      limit: 'Boundary: Gekta does not determine quality instead of the laboratory, change the contract, authorise payment or make a legal decision.',
      cta: 'Explore Gekta',
    },
    authority: 'Gekta and external systems do not act instead of a participant.',
    laboratory: 'Gekta does not replace measurement or laboratory signature',
    finalDecision: 'Only an authorised participant or connected system acting within the agreed scenario. Gekta explains but does not take over authority.',
  },
  zh: {
    nav: 'Gekta',
    proof: { label: '流程内的 Gekta', text: '农业智能发现偏差，但不取代参与方权限' },
    comparison: 'Gekta 分析具体交易、来源与角色限制。',
    control: 'Gekta、分析、API、ERP/1C、物流、实验室与财务。',
    deviationEvent: 'Gekta 对照交易条件',
    deviationBoundary: 'Gekta 不会自行修改合同或批准结算。',
    confidenceLabel: 'Gekta 置信度',
    abstentionEvent: 'Gekta 保留结论',
    tai: {
      eyebrow: 'Gekta · 农业智能',
      title: 'Gekta 是具体交易的智能层',
      lead: '它理解平台角色、阶段、文件与规则，并在回答中区分事实、结论、风险与缺失数据。',
      analysisLabel: 'Gekta · 交易分析',
      limit: '边界：Gekta 不代替实验室确定质量，不修改合同，不批准付款，也不作出法律决定。',
      cta: '进一步了解 Gekta',
    },
    authority: 'Gekta 和外部系统不会代替参与方操作。',
    laboratory: 'Gekta 不替代测量和实验室签名',
    finalDecision: '只有获授权参与方或已接入系统可在约定场景内作出决定。Gekta 负责解释，但不会取代权限。',
  },
} as const;

export function getPlatformV7HomeStoryCopy(locale: string) {
  const base = getBaseStoryCopy(locale);
  const localized = locale === 'en' ? COPY.en : locale === 'zh' ? COPY.zh : COPY.ru;

  return {
    ...base,
    nav: { ...base.nav, tai: localized.nav },
    proof: base.proof.map((item, index) => index === 3 ? { ...item, ...localized.proof } : item),
    difference: {
      ...base.difference,
      rows: base.difference.rows.map((row, index) => index === 4 ? { ...row, platform: localized.comparison } : row),
    },
    functions: {
      ...base.functions,
      items: base.functions.items.map((item, index) => index === 7 ? { ...item, text: localized.control } : item),
    },
    demo: {
      ...base.demo,
      states: base.demo.states.map((state, stateIndex) => {
        if (stateIndex === 1) {
          return {
            ...state,
            events: state.events.map((event, eventIndex) => eventIndex === 1 ? { ...event, title: localized.deviationEvent } : event),
            actionText: localized.deviationBoundary,
          };
        }
        if (stateIndex === 2) {
          return {
            ...state,
            kpis: state.kpis.map((kpi, kpiIndex) => kpiIndex === 1 ? { ...kpi, label: localized.confidenceLabel } : kpi),
            events: state.events.map((event, eventIndex) => eventIndex === 1 ? { ...event, title: localized.abstentionEvent } : event),
          };
        }
        return state;
      }),
    },
    tai: { ...base.tai, ...localized.tai },
    trust: {
      ...base.trust,
      items: base.trust.items.map((item, index) => index === 3 ? { ...item, text: localized.authority } : item),
      integrations: base.trust.integrations.map((integration, index) => index === 2 ? { ...integration, boundary: localized.laboratory } : integration),
    },
    faq: {
      ...base.faq,
      items: base.faq.items.map((item, index) => index === 2 ? { ...item, answer: localized.finalDecision } : item),
    },
  };
}
