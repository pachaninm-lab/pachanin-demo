import { P7Badge } from './P7Badge';
import type { ProviderCode } from '@/lib/platform-v7/integrations/providerRegistry';
import {
  getPlatformV7Provider,
  getProviderConnectionStatusLabel,
  type ProviderConnectionStatus,
} from '@/lib/platform-v7/integrations/providerRegistry';

export function ProviderStatusBadge({ status }: { readonly status: ProviderConnectionStatus }) {
  const tone = status === 'live_connected' ? 'success' : status === 'degraded' || status === 'down' ? 'danger' : status === 'manual_review' ? 'warning' : status === 'test_connected' ? 'info' : 'neutral';

  return <P7Badge tone={tone}>{getProviderConnectionStatusLabel(status)}</P7Badge>;
}

export function FactSourceBadge({ provider }: { readonly provider: ProviderCode }) {
  const source = getPlatformV7Provider(provider);

  return (
    <span title={`Источник факта: ${source.displayName}. Статус: ${getProviderConnectionStatusLabel(source.connectionStatus)}. Следующий шаг: ${source.nextLiveStep}`}>
      <P7Badge tone="integration">Источник: {source.publicLabel}</P7Badge>
    </span>
  );
}
