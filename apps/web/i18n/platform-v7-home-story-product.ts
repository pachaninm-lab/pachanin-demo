import { getPlatformV7HomeStoryCopy as getOperatingStoryCopy } from './platform-v7-home-story-operating';

export function getPlatformV7HomeStoryCopy(locale: string) {
  const copy = getOperatingStoryCopy(locale);
  if (locale === 'en' || locale === 'zh') return copy;

  return {
    ...copy,
    difference: {
      ...copy.difference,
      lead: `От согласования цены до закрытия Сделки — один управляемый процесс. ${copy.difference.lead}`,
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
