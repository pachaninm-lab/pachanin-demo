// Фабрика внешних адаптеров: единая точка выбора между симуляцией (mock) и
// боевым контуром (real). Это шов интеграции из §43 — разработчику достаточно
// реализовать PlatformV7ExternalAdapter для каждой системы и зарегистрировать
// боевой реестр через platformV7RegisterRealAdapterRegistry(); код платформы
// продолжит работать без изменений. До регистрации боевого реестра режим real
// падает с понятной ошибкой, а не молча подменяет данные.

import {
  platformV7CreateMockAdapterRegistry,
  type PlatformV7AdapterRegistry,
} from './external-adapters';
import {
  normalizePlatformV7Environment,
  type PlatformEnvironment,
} from './environment';

export type PlatformV7AdapterMode = 'mock' | 'real';

export type PlatformV7RealAdapterRegistryFactory = () => PlatformV7AdapterRegistry;

export interface PlatformV7AdapterFactoryOptions {
  // Явный режим имеет приоритет над окружением (удобно для тестов и пилота).
  readonly mode?: PlatformV7AdapterMode;
  readonly environment?: PlatformEnvironment;
}

export const PLATFORM_V7_MISSING_REAL_REGISTRY_MESSAGE =
  'Боевой реестр адаптеров не зарегистрирован. Реализуйте PlatformV7ExternalAdapter для каждой системы ' +
  '(bank, fgis, edo, epd, logistics, lab, oneC, notification) и вызовите platformV7RegisterRealAdapterRegistry() ' +
  'до запуска в режиме real. Образец реализации: lib/platform-v7/adapters/real-adapter-template.ts.';

// Хук регистрации боевого реестра. Хранится в модульном состоянии, чтобы код
// платформы не зависел напрямую от партнёрских библиотек: реальная реализация
// подключается из точки сборки приложения, а ядро остаётся переносимым.
let realAdapterRegistryFactory: PlatformV7RealAdapterRegistryFactory | null = null;

export function platformV7RegisterRealAdapterRegistry(
  factory: PlatformV7RealAdapterRegistryFactory,
): void {
  realAdapterRegistryFactory = factory;
}

export function platformV7ClearRealAdapterRegistry(): void {
  realAdapterRegistryFactory = null;
}

export function platformV7HasRealAdapterRegistry(): boolean {
  return realAdapterRegistryFactory !== null;
}

// Промышленный контур разрешён только в production-окружении; все остальные режимы
// (pilot/sandbox/demo) работают на симуляции. Это согласовано с
// platformV7CanShowAsLive(): «боевым» считается только production.
export function platformV7ResolveAdapterMode(environment: PlatformEnvironment): PlatformV7AdapterMode {
  return environment === 'production' ? 'real' : 'mock';
}

export function platformV7ResolveEnvironment(
  raw: string | undefined = process.env.NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT,
): PlatformEnvironment {
  return normalizePlatformV7Environment(raw);
}

export function platformV7CreateAdapterRegistry(
  options: PlatformV7AdapterFactoryOptions = {},
): PlatformV7AdapterRegistry {
  const environment = options.environment ?? platformV7ResolveEnvironment();
  const mode = options.mode ?? platformV7ResolveAdapterMode(environment);

  if (mode === 'mock') {
    return platformV7CreateMockAdapterRegistry();
  }

  if (!realAdapterRegistryFactory) {
    throw new Error(PLATFORM_V7_MISSING_REAL_REGISTRY_MESSAGE);
  }

  return realAdapterRegistryFactory();
}
