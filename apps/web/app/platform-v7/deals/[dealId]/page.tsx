import { LiveDealDetailRuntime } from '@/components/v7r/LiveDealDetailRuntime';

export default function PlatformV7DealDetailPage({ params }) {
  return <LiveDealDetailRuntime id={params.dealId} />;
}
