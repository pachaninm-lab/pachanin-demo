export type PlatformV7DealWorkspaceTabId = 'overview' | 'documents' | 'logistics' | 'money' | 'dispute';

export interface PlatformV7DealWorkspaceTab {
  id: PlatformV7DealWorkspaceTabId;
  label: string;
  hash: string;
  description: string;
}

export const PLATFORM_V7_DEAL_WORKSPACE_TABS: PlatformV7DealWorkspaceTab[] = [
  {
    id: 'overview',
    label: 'Обзор',
    hash: '#overview',
    description: 'Статус, стороны, SLA, следующий владелец и главный blocker.',
  },
  {
    id: 'documents',
    label: 'Документы',
    hash: '#documents',
    description: 'Пакет документов, версии, подписи, СДИЗ и доказательства.',
  },
  {
    id: 'logistics',
    label: 'Логистика',
    hash: '#logistics',
    description: 'Рейс, водитель, ETA, приёмка, вес и отклонения маршрута.',
  },
  {
    id: 'money',
    label: 'Деньги',
    hash: '#money',
    description: 'Reserve, hold, release, НДС, цена за тонну и банковские события.',
  },
  {
    id: 'dispute',
    label: 'Спор',
    hash: '#dispute',
    description: 'Активный спор, evidence, решение и денежный эффект.',
  },
];

export interface PlatformV7DealWorkspaceModel {
  tabs: PlatformV7DealWorkspaceTab[];
  defaultTab: PlatformV7DealWorkspaceTabId;
  maxPrimaryActions: 1;
  maxSecondaryActions: 2;
  mobileSidePanel: 'bottom-sheet';
}

export function platformV7DealWorkspaceModel(): PlatformV7DealWorkspaceModel {
  return {
    tabs: PLATFORM_V7_DEAL_WORKSPACE_TABS,
    defaultTab: 'overview',
    maxPrimaryActions: 1,
    maxSecondaryActions: 2,
    mobileSidePanel: 'bottom-sheet',
  };
}

export function platformV7DealWorkspaceTabByHash(hash: string): PlatformV7DealWorkspaceTab {
  return PLATFORM_V7_DEAL_WORKSPACE_TABS.find((tab) => tab.hash === hash) ?? PLATFORM_V7_DEAL_WORKSPACE_TABS[0]!;
}

export function platformV7DealWorkspaceTabById(id: PlatformV7DealWorkspaceTabId): PlatformV7DealWorkspaceTab {
  return PLATFORM_V7_DEAL_WORKSPACE_TABS.find((tab) => tab.id === id) ?? PLATFORM_V7_DEAL_WORKSPACE_TABS[0]!;
}
