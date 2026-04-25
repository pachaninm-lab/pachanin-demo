import { PLATFORM_V7_LEXICON } from './lexicon';

export type PlatformEnvironment = 'pilot' | 'sandbox' | 'demo' | 'production';
export type PlatformEnvironmentTone = 'green' | 'amber' | 'blue' | 'red';

export interface PlatformEnvironmentInfo {
  environment: PlatformEnvironment;
  label: string;
  description: string;
  tone: PlatformEnvironmentTone;
  canShowAsLive: boolean;
}

export const PLATFORM_V7_ENVIRONMENT_DESCRIPTIONS: Record<PlatformEnvironment, string> = {
  pilot: 'Предынтеграционный контур controlled pilot: действия демонстрируют механику, боевые подключения требуют подтверждения.',
  sandbox: 'Тестовая среда: данные и действия не являются боевыми.',
  demo: 'Демо-данные: сценарии нужны для показа логики исполнения сделки.',
  production: 'Боевой контур: отображать только подтверждённые действия и статусы.',
};

export const PLATFORM_V7_ENVIRONMENT_TONES: Record<PlatformEnvironment, PlatformEnvironmentTone> = {
  pilot: 'amber',
  sandbox: 'blue',
  demo: 'blue',
  production: 'green',
};

export function normalizePlatformV7Environment(raw: string | undefined): PlatformEnvironment {
  return raw === 'production' || raw === 'sandbox' || raw === 'demo' || raw === 'pilot' ? raw : 'pilot';
}

export function platformV7EnvironmentInfo(environment: PlatformEnvironment): PlatformEnvironmentInfo {
  return {
    environment,
    label: PLATFORM_V7_LEXICON.env[environment],
    description: PLATFORM_V7_ENVIRONMENT_DESCRIPTIONS[environment],
    tone: PLATFORM_V7_ENVIRONMENT_TONES[environment],
    canShowAsLive: environment === 'production',
  };
}

export function getPlatformV7Environment(): PlatformEnvironmentInfo {
  return platformV7EnvironmentInfo(normalizePlatformV7Environment(process.env.NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT));
}

export function platformV7EnvironmentLabel(environment: PlatformEnvironment): string {
  return platformV7EnvironmentInfo(environment).label;
}

export function platformV7CanShowAsLive(environment: PlatformEnvironment): boolean {
  return platformV7EnvironmentInfo(environment).canShowAsLive;
}
