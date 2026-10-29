import { PlatformV7StrategicHome as BasePlatformV7StrategicHome } from './PlatformV7StrategicHome';
import '@/styles/platform-v7-international-home-fix.css';

/**
 * The public route is aliased to this module by tsconfig.
 * Keep the wrapper transparent: visitor-visible structure and copy are owned by
 * PlatformV7StrategicHome itself so no locale layer can silently remove or
 * inject sections after the canonical page has been built.
 */
export async function PlatformV7StrategicHome() {
  return BasePlatformV7StrategicHome();
}
