export type BrowserFamily = 'chrome' | 'yandex' | 'edge' | 'firefox' | 'safari' | 'unknown';
export type CapabilityName = 'offline_queue' | 'camera_capture' | 'geolocation' | 'pwa_install' | 'background_sync' | 'file_upload';
export type BrowserAccessStatus = 'READY' | 'DEGRADED' | 'BLOCKED';

export type BrowserCapabilityPolicy = {
  capability: CapabilityName;
  requiredFor: string[];
  fallback: 'manual' | 'none' | 'queue_only';
};

export type BrowserAccessDecision = {
  browser: BrowserFamily;
  status: BrowserAccessStatus;
  supportedCapabilities: CapabilityName[];
  degradedCapabilities: CapabilityName[];
  blockedCapabilities: CapabilityName[];
  message: string;
};

export const BROWSER_CAPABILITY_POLICIES: BrowserCapabilityPolicy[] = [
  { capability: 'offline_queue', requiredFor: ['field_mobile', 'driver_mobile', 'lab_mobile'], fallback: 'queue_only' },
  { capability: 'camera_capture', requiredFor: ['field_mobile', 'driver_mobile', 'lab_mobile', 'receiving'], fallback: 'manual' },
  { capability: 'geolocation', requiredFor: ['driver_mobile', 'logistics'], fallback: 'manual' },
  { capability: 'pwa_install', requiredFor: ['field_mobile', 'farmer_mobile'], fallback: 'manual' },
  { capability: 'background_sync', requiredFor: ['field_mobile', 'driver_mobile'], fallback: 'queue_only' },
  { capability: 'file_upload', requiredFor: ['documents', 'onboarding', 'lab'], fallback: 'none' }
];

export function detectBrowserFamily(userAgent?: string | null): BrowserFamily {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (ua.includes('yabrowser')) return 'yandex';
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/') || ua.includes('crios/')) return 'chrome';
  if (ua.includes('safari/') || ua.includes('iphone') || ua.includes('ipad')) return 'safari';
  return 'unknown';
}

export function evaluateBrowserAccess(input: {
  userAgent?: string | null;
  requestedCapabilities?: CapabilityName[];
  isPwaInstalled?: boolean;
}) : BrowserAccessDecision {
  const browser = detectBrowserFamily(input.userAgent);
  const requested = Array.from(new Set(input.requestedCapabilities || []));
  const supportedCapabilities: CapabilityName[] = [];
  const degradedCapabilities: CapabilityName[] = [];
  const blockedCapabilities: CapabilityName[] = [];

  for (const capability of requested) {
    if (browser === 'unknown') {
      blockedCapabilities.push(capability);
      continue;
    }
    if (browser === 'safari' && capability === 'background_sync') {
      degradedCapabilities.push(capability);
      continue;
    }
    if ((browser === 'firefox' || browser === 'safari') && capability === 'pwa_install' && !input.isPwaInstalled) {
      degradedCapabilities.push(capability);
      continue;
    }
    supportedCapabilities.push(capability);
  }

  if (blockedCapabilities.length > 0) {
    return {
      browser,
      status: 'BLOCKED',
      supportedCapabilities,
      degradedCapabilities,
      blockedCapabilities,
      message: `Браузер ${browser} не поддерживает обязательные возможности: ${blockedCapabilities.join(', ')}.`
    };
  }

  if (degradedCapabilities.length > 0) {
    return {
      browser,
      status: 'DEGRADED',
      supportedCapabilities,
      degradedCapabilities,
      blockedCapabilities,
      message: `Браузер ${browser} допускается, но часть функций будет работать в режиме graceful degradation: ${degradedCapabilities.join(', ')}.`
    };
  }

  return {
    browser,
    status: 'READY',
    supportedCapabilities,
    degradedCapabilities,
    blockedCapabilities,
    message: `Браузер ${browser} подходит для рабочего контура.`
  };
}
