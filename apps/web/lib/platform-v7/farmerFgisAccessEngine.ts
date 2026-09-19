export type FarmerFgisAccessMode =
  | 'esia_org_confirmed'
  | 'fgis_api_credentials_required'
  | 'owner_manual_import'
  | 'operator_power_of_attorney';

export type FarmerFgisAccessStatus =
  | 'not_started'
  | 'requires_farmer_action'
  | 'review_required'
  | 'ready_to_import'
  | 'blocked';

export type FgisPullStatus =
  | 'not_requested'
  | 'can_pull'
  | 'manual_only'
  | 'blocked';

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
  apiVersion: string;
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

/**
 * Type-only compatibility contract. Runtime organization, access, lot and
 * certificate facts come from authenticated server integrations and persisted
 * PostgreSQL authority envelopes. This module must not export local fixtures,
 * readiness functions, labels or route decisions.
 */
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
