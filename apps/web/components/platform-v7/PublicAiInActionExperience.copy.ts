import { EN_COPY } from './PublicAiInActionExperience.copy.en';
import { RU_COPY } from './PublicAiInActionExperience.copy.ru';
import { ZH_COPY } from './PublicAiInActionExperience.copy.zh';
import type { ExperienceCopy, Locale } from './PublicAiInActionExperience.types';

export { FACT_ICONS, FACT_ORDER } from './PublicAiInActionExperience.types';
export type { FactKey, FeedbackKey, RoleKey, ScenarioKey } from './PublicAiInActionExperience.types';

export const COPY: Record<Locale, ExperienceCopy> = {
  ru: RU_COPY,
  en: EN_COPY,
  zh: ZH_COPY,
};

export function resolveLocale(locale: string): Locale {
  if (locale === 'en' || locale === 'zh') return locale;
  return 'ru';
}
