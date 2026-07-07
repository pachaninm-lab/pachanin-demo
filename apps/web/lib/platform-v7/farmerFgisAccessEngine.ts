export type FarmerFgisAccessMode =
  | 'esia_org_confirmed'
  | 'fgis_api_credentials_required'
  | 'owner_manual_import'
  | 'operator_power_of_attorney';

export type FarmerFgisAccessStatus = 'not_started' | 'requires_farmer_action' | 'review_required' | 'ready_to_import' | 'blocked';
export type FgisPullStatus = 'not_requested' | 'can_pull' | 'manual_only' | 'blocked';

export type FarmerFgisAccessStep = {
  key: string;
  label: string;
  status: 'ok' | 'action' | 'review' | 'blocked';
  owner: 'Фермер' | 'Оператор' | 'Комплаенс' | 'Интеграция';
};

export type FgisDealImportKey = {
  ownerInn: string;
  lotNumber?: string;
  sdizNumber?: string;
};

export type FgisDealSeed = {
  seedId: string;
  source: 'FGIS_ZERNO';
  apiVersion: '1.0.23';
  lotNumber: string;
  sdizNumber: string;
  ownerInn: string;
  ownerName: string;
  culture: string;
  className: string;
  massKg: number;
  availableKg: number;
  storagePlace: string;
  quality: Array<{ label: string; value: string }>;
};

export type FarmerFgisAccessState = {
  status: FarmerFgisAccessStatus;
  pullStatus: FgisPullStatus;
  farmerName: string;
  farmerInn: string;
  accessModes: FarmerFgisAccessMode[];
  steps: FarmerFgisAccessStep[];
  importKeys: FgisDealImportKey;
  dealSeed: FgisDealSeed;
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export const FARMER_FGIS_ACCESS_STATE: FarmerFgisAccessState = {
  status: 'review_required',
  pullStatus: 'manual_only',
  farmerName: 'ООО «АгроПоставка»',
  farmerInn: '6829000000',
  accessModes: ['esia_org_confirmed', 'owner_manual_import', 'fgis_api_credentials_required'],
  steps: [
    { key: 'esia-org', label: 'подтвердить организацию через ЕСИА или иной утверждённый бизнес-вход', status: 'action', owner: 'Фермер' },
    { key: 'fgis-account', label: 'убедиться, что организация есть в ФГИС Зерно как товаропроизводитель', status: 'review', owner: 'Фермер' },
    { key: 'right-to-act', label: 'подтвердить руководителя или представителя организации', status: 'review', owner: 'Комплаенс' },
    { key: 'import-key', label: 'указать номер партии, лота или СДИЗ', status: 'ok', owner: 'Фермер' },
    { key: 'owner-match', label: 'сверить ИНН владельца в ФГИС с ИНН участника платформы', status: 'ok', owner: 'Интеграция' },
    { key: 'credentials', label: 'подключить промышленный API-доступ или оставить ручной импорт до подключения', status: 'review', owner: 'Интеграция' },
  ],
  importKeys: {
    ownerInn: '6829000000',
    lotNumber: 'FGIS-LOT-2607-014',
    sdizNumber: 'SDIZ-2607-5512',
  },
  dealSeed: {
    seedId: 'FGIS-SEED-2607-014',
    source: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    lotNumber: 'FGIS-LOT-2607-014',
    sdizNumber: 'SDIZ-2607-5512',
    ownerInn: '6829000000',
    ownerName: 'ООО «АгроПоставка»',
    culture: 'Пшеница',
    className: '4 класс',
    massKg: 520000,
    availableKg: 520000,
    storagePlace: 'Элеватор №17',
    quality: [
      { label: 'Влажность', value: '13,8%' },
      { label: 'Клейковина', value: '21%' },
      { label: 'Сорная примесь', value: '2,0%' },
    ],
  },
  nextRoutes: [
    { label: 'Импорт ФГИС-лота', href: '/platform-v7/auction/import', owner: 'Оператор' },
    { label: 'Допуск торгов', href: '/platform-v7/auction/admission', owner: 'Комплаенс' },
    { label: 'Аукцион', href: '/platform-v7/auction', owner: 'Продавец' },
  ],
};

export function fgisAccessStatusLabel(status: FarmerFgisAccessStatus) {
  if (status === 'ready_to_import') return 'готово к импорту';
  if (status === 'requires_farmer_action') return 'нужно действие фермера';
  if (status === 'review_required') return 'требует проверки';
  if (status === 'blocked') return 'заблокировано';
  return 'не начато';
}

export function fgisPullStatusLabel(status: FgisPullStatus) {
  if (status === 'can_pull') return 'можно загрузить из ФГИС';
  if (status === 'manual_only') return 'ручной импорт до API-доступа';
  if (status === 'blocked') return 'загрузка закрыта';
  return 'запрос не отправлен';
}

export function canPullFgisDealSeed(state: FarmerFgisAccessState) {
  return state.pullStatus === 'can_pull' && state.steps.every((step) => step.status === 'ok');
}
