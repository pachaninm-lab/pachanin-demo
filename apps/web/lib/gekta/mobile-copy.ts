import type { GektaLocale } from './content';

export type GektaMobileHeroCopy = Readonly<{
  eyebrow: string;
  h1: string;
  lead: string;
}>;

const COPY: Record<GektaLocale, GektaMobileHeroCopy> = {
  ru: {
    eyebrow: 'ГЕКТА · АГРАРНЫЙ ИНТЕЛЛЕКТ',
    h1: 'Гекта — аграрный ИИ для хозяйства и агробизнеса',
    lead: 'Задай вопрос по полю, животным, технике, документам или экономике хозяйства. Гекта удерживает контекст, показывает риски и следующий шаг.',
  },
  en: {
    eyebrow: 'GEKTA · AGRICULTURAL INTELLIGENCE',
    h1: 'Gekta — agricultural AI for farms and agribusiness',
    lead: 'Ask about fields, livestock, machinery, documents or farm economics. Gekta keeps the context, shows risks and gives the next step.',
  },
  zh: {
    eyebrow: 'GEKTA · 农业智能',
    h1: 'Gekta——面向农场与农业经营的农业人工智能',
    lead: '可就田间、畜牧、农机、文件或农场经济提问。Gekta 会保持上下文，提示风险并给出下一步。',
  },
};

export function getGektaMobileHeroCopy(locale: GektaLocale): GektaMobileHeroCopy {
  return COPY[locale];
}
