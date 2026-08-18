import { getPlatformV7HomeStoryCopy as getOperatingStoryCopy } from './platform-v7-home-story-operating';

const accountingFaq = {
  ru: {
    question: 'Как бухгалтер работает с 1С и ЭДО?',
    answer: 'После подключения организации бухгалтер продолжает работать в привычной 1С и ЭДО. Платформа связывает подтверждённые данные и статусы со Сделкой, показывает расхождения и следующий шаг; конкретный маршрут выбирается при подключении организации.',
  },
  en: {
    question: 'How does an accountant work with 1C and EDI?',
    answer: 'Once the organisation is connected, the accountant continues working in the familiar 1C and EDI systems. The platform ties verified data and statuses to the Deal, shows mismatches and the next step; the specific route is selected during organisation onboarding.',
  },
  zh: {
    question: '会计人员如何使用 1C 和电子单据系统？',
    answer: '机构完成接入后，会计人员继续使用熟悉的 1C 和电子单据系统。平台把已确认的数据与状态关联到交易，显示差异和下一步；具体接入路径在机构接入时选择。',
  },
} as const;

export function getPlatformV7HomeStoryCopy(locale: string) {
  const copy = getOperatingStoryCopy(locale);
  const faqLocale = locale === 'en' ? 'en' : locale === 'zh' ? 'zh' : 'ru';
  const withAccountingFaq = {
    ...copy,
    faq: {
      ...copy.faq,
      items: [...copy.faq.items, accountingFaq[faqLocale]],
    },
  };

  if (faqLocale !== 'ru') return withAccountingFaq;

  return {
    ...withAccountingFaq,
    difference: {
      ...withAccountingFaq.difference,
      lead: `От согласования цены до закрытия Сделки — один управляемый процесс. ${withAccountingFaq.difference.lead}`,
    },
  };
}

/**
 * Stable acceptance vocabulary for the approved operating-product presentation.
 * The rendered copy lives in platform-v7-home-story-operating.ts.
 */
export const platformV7HomepageProductCopyAcceptance = {
  ru: {
    system: 'Полный контур агросделки собран в одной рабочей системе',
    unity: 'Все функции работают как единая Сделка',
    authority: 'Критические решения подтверждает уполномоченный участник.',
  },
  en: {
    system: 'The complete agricultural Deal workflow in one operating system',
    unity: 'Every capability works as one Deal',
    authority: 'Critical decisions are confirmed by an authorised participant.',
  },
  zh: {
    system: '完整农业交易流程集中在同一工作系统',
    unity: '所有能力共同构成同一笔交易',
    authority: '关键决定由获授权的参与方确认。',
  },
} as const;
