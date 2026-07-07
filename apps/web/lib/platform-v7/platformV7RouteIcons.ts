import { BadgeCheck, Banknote, ClipboardCheck, FileCheck2, FlaskConical, Landmark, Route, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';

export type PlatformV7RouteIconKey =
  | 'fgis'
  | 'auction'
  | 'deal'
  | 'logistics'
  | 'acceptance'
  | 'quality'
  | 'documents'
  | 'settlement'
  | 'compliance'
  | 'dispute';

export const PLATFORM_V7_ROUTE_ICONS: Record<PlatformV7RouteIconKey, LucideIcon> = {
  fgis: Wheat,
  auction: BadgeCheck,
  deal: ClipboardCheck,
  logistics: Truck,
  acceptance: Route,
  quality: FlaskConical,
  documents: FileCheck2,
  settlement: Landmark,
  compliance: ShieldCheck,
  dispute: Scale,
};

export const PLATFORM_V7_ROUTE_ICON_LABELS: Record<PlatformV7RouteIconKey, string> = {
  fgis: 'ФГИС',
  auction: 'Аукцион',
  deal: 'Сделка',
  logistics: 'Логистика',
  acceptance: 'Приёмка',
  quality: 'Качество',
  documents: 'Документы',
  settlement: 'Расчёты',
  compliance: 'Комплаенс',
  dispute: 'Спор',
};

export function platformV7RouteIcon(key: PlatformV7RouteIconKey) {
  return PLATFORM_V7_ROUTE_ICONS[key];
}
