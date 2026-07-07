import type { FgisLotSnapshot } from './fgisAuctionEngine';

export type FgisAuctionImportRequest = {
  lotNumber?: string;
  sdizNumber?: string;
  ownerInn: string;
  requestedVolumeKg?: number;
};

export type FgisAuctionImportResult = {
  ok: boolean;
  lot?: FgisLotSnapshot;
  checks: Array<{ key: string; label: string; ok: boolean }>;
  reason?: string;
};

export const FGIS_AUCTION_IMPORT_FIELDS = [
  'номер партии или лота',
  'номер СДИЗ при наличии',
  'ИНН владельца',
  'доступная масса',
  'культура и класс',
  'показатели качества',
  'элеватор или место хранения',
  'статус документов',
] as const;

export function buildFgisAuctionImportChecks(request: FgisAuctionImportRequest) {
  return [
    { key: 'source-id', label: 'передан номер партии, лота или СДИЗ', ok: Boolean(request.lotNumber || request.sdizNumber) },
    { key: 'owner-inn', label: 'передан ИНН владельца', ok: /^\d{10}|\d{12}$/.test(request.ownerInn) },
    { key: 'volume', label: 'объём не превышает доступную массу', ok: request.requestedVolumeKg === undefined || request.requestedVolumeKg > 0 },
  ];
}

export function explainFgisAuctionImport() {
  return [
    'адаптер не создаёт лот вручную без источника',
    'если ФГИС не подключён, лот уходит на ручную проверку',
    'СДИЗ и партия связываются до открытия торгов',
    'аукцион открывается только после допуска',
    'победившая ставка создаёт основание сделки',
  ];
}
