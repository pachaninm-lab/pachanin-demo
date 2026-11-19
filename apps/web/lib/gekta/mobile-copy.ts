import type { GektaLocale } from './content';

export type GektaMobileHeroCopy = Readonly<{
  eyebrow: string;
  h1: string;
  lead: string;
}>;

const COPY: Record<GektaLocale, GektaMobileHeroCopy> = {
  ru: {
    eyebrow: 'ГЕКТА · АГРАРНЫЙ ИНТЕЛЛЕКТ',
    h1: 'Чем помочь хозяйству?',
    lead: 'Задай аграрный вопрос, приложи документ или проверь расчёт.',
  },
  en: {
    eyebrow: 'GEKTA · AGRICULTURAL INTELLIGENCE',
    h1: 'How can I help your farm?',
    lead: 'Ask an agricultural question, attach a document or check a calculation.',
  },
  zh: {
    eyebrow: 'GEKTA · 农业智能',
    h1: '有什么农业问题？',
    lead: '你可以咨询农业问题、上传文件，或核对农场经营计算。',
  },
};

export function getGektaMobileHeroCopy(locale: GektaLocale): GektaMobileHeroCopy {
  return COPY[locale];
}
