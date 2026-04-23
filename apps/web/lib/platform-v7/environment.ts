import { PLATFORM_V7_LEXICON } from './lexicon';

export type PlatformEnvironment = 'pilot' | 'sandbox' | 'demo' | 'production';

export interface PlatformEnvironmentInfo {
  environment: PlatformEnvironment;
  label: string;
  description: string;
  tone: 'green' | 'amber' | 'blue' | 'red';
}

export function getPlatformV7Environment(): PlatformEnvironmentInfo {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT as PlatformEnvironment | undefined;
  const environment: PlatformEnvironment = raw === 'production' || raw === 'sandbox' || raw === 'demo' || raw === 'pilot' ? raw : 'pilot';

  const descriptions: Record<PlatformEnvironment, string> = {
    pilot: 'Предынтеграционный контур controlled pilot: действия демонстрируют механику, боевые подключения требуют подтверждения.',
    sandbox: 'Тестовая среда: данные и действия не являются боевыми.',
    demo: 'Демо-данные: сценарии нужны для показа логики исполнения сделки.',
    production: 'Боевой контур: отображать только подтверждённые действия и статусы.',
  };

  const tones: Record<PlatformEnvironment, PlatformEnvironmentInfo['tone']> = {
    pilot: 'amber',
    sandbox: 'blue',
    demo: 'blue',
    production: 'green',
  };

  return {
    environment,
    label: PLATFORM_V7_LEXICON.env[environment],
    description: descriptions[environment],
    tone: tones[environment],
  };
}
