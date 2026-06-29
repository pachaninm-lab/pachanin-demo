// Runtime feature flag resolver for GrainFlow
// Reads from NEXT_PUBLIC_FF_* env vars at build time + localStorage overrides in dev

export type FeatureFlagId =
  | 'ff_mfa_totp'           // TOTP MFA for high-privilege actions
  | 'ff_mfa_sms'            // SMS OTP for deal signing
  | 'ff_ukep_signing'       // УКЭП (qualified e-signature) integration
  | 'ff_hash_chain_events'  // DealEvent SHA-256 hash chain
  | 'ff_double_entry_ledger'// Append-only double-entry ledger
  | 'ff_saga_orchestrator'  // Saga orchestrator for deal lifecycle
  | 'ff_audit_log'          // Cryptographic audit log (152-FZ)
  | 'ff_edo_integration'    // ЭДО (Diadok/Saby) integration
  | 'ff_fgis_zerno'         // ФГИС «Зерно» live integration
  | 'ff_aml_check'          // AML check on deal creation
  | 'ff_dispute_calculator' // Interactive dispute hold calculator
  | 'ff_documents_tree'     // Documents tree view
  | 'ff_payment_heatmap'    // Payment calendar heatmap
  | 'ff_recently_viewed'    // Recently viewed widget
  | 'ff_pwa_offline'        // PWA offline support
  | 'ff_yandex_maps'        // Yandex Maps integration
  | 'ff_demo_data';          // Demo/mock data mode

export interface FeatureFlag {
  id: FeatureFlagId;
  label: string;
  defaultEnabled: boolean;
  envKey?: string;
  demoOnly?: boolean;
  /** Флаг работает на демо-ответах, не на боевом API */
  demoAnswer?: boolean;
  demoNote?: string;
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'ff_mfa_totp',            label: 'MFA — TOTP (Authenticator)',       defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_MFA_TOTP',     demoAnswer: true, demoNote: 'TOTP-верификация работает на заглушке — реальный TOTP требует backend-контура' },
  { id: 'ff_mfa_sms',             label: 'MFA — SMS OTP',                    defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_MFA_SMS',      demoAnswer: true, demoNote: 'SMS-шлюз не подключён — ОТП генерируется на клиенте' },
  { id: 'ff_ukep_signing',        label: 'УКЭП подписание документов',        defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_UKEP',         demoAnswer: true, demoNote: 'КриптоПро DSS — предынтеграционный контур, боевое подписание не заявляется' },
  { id: 'ff_hash_chain_events',   label: 'Hash-chain событий сделки',         defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_HASH_CHAIN' },
  { id: 'ff_double_entry_ledger', label: 'Двойная запись (ledger)',           defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_LEDGER' },
  { id: 'ff_saga_orchestrator',   label: 'Saga Orchestrator',                 defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_SAGA' },
  { id: 'ff_audit_log',           label: 'Аудит лог (152-ФЗ)',                defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_AUDIT_LOG' },
  { id: 'ff_edo_integration',     label: 'ЭДО интеграция (Диадок/Saby)',      defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_EDO',          demoAnswer: true, demoNote: 'Диадок/Saby: договор не заключён — ответы эмулируются' },
  { id: 'ff_fgis_zerno',          label: 'ФГИС «Зерно» live',                 defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_FGIS',         demoAnswer: true, demoNote: 'ФГИС «Зерно»: боевой API требует учётных данных Минсельхоза — сейчас демо-ответ' },
  { id: 'ff_aml_check',           label: 'AML проверка при создании сделки',  defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_AML',          demoAnswer: true, demoNote: 'AML-сервис: sandbox-режим, реальная проверка требует договора' },
  { id: 'ff_dispute_calculator',  label: 'Калькулятор удержания',             defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_DISPUTE_CALC' },
  { id: 'ff_documents_tree',      label: 'Дерево документов',                 defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_DOCS_TREE' },
  { id: 'ff_payment_heatmap',     label: 'Heatmap выплат',                    defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_HEATMAP' },
  { id: 'ff_recently_viewed',     label: 'Последние просмотренные',           defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_RECENT' },
  { id: 'ff_pwa_offline',         label: 'PWA офлайн (водитель)',             defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_PWA' },
  { id: 'ff_yandex_maps',         label: 'Яндекс.Карты',                      defaultEnabled: false, envKey: 'NEXT_PUBLIC_FF_YANDEX_MAPS', demoAnswer: true, demoNote: 'Яндекс.Карты JS API: ключ не задан — показывается SVG-заглушка маршрута' },
  { id: 'ff_demo_data',           label: 'Режим демо-данных',                 defaultEnabled: true,  envKey: 'NEXT_PUBLIC_FF_DEMO', demoOnly: true },
];

const OVERRIDE_PREFIX = 'grainflow_ff_';

function readEnvFlag(envKey: string | undefined, fallback: boolean): boolean {
  if (!envKey) return fallback;
  const val = process.env[envKey];
  if (val === undefined || val === null) return fallback;
  return val === '1' || val === 'true';
}

function readLocalOverride(id: FeatureFlagId): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(`${OVERRIDE_PREFIX}${id}`);
    if (val === null) return null;
    return val === '1' || val === 'true';
  } catch {
    return null;
  }
}

export function isFeatureEnabled(id: FeatureFlagId): boolean {
  const flag = FEATURE_FLAGS.find((f) => f.id === id);
  if (!flag) return false;
  const localOverride = readLocalOverride(id);
  if (localOverride !== null) return localOverride;
  return readEnvFlag(flag.envKey, flag.defaultEnabled);
}

export function setFeatureOverride(id: FeatureFlagId, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${OVERRIDE_PREFIX}${id}`, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function clearFeatureOverride(id: FeatureFlagId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${OVERRIDE_PREFIX}${id}`);
  } catch {
    // ignore
  }
}

export function getAllFlags(): Array<{ flag: FeatureFlag; enabled: boolean }> {
  return FEATURE_FLAGS.map((flag) => ({ flag, enabled: isFeatureEnabled(flag.id) }));
}
