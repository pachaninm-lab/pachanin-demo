import { LiveDealInvestorRuntime } from '@/components/v7r/LiveDealInvestorRuntime';

export default function PlatformV7DealDetailPage({ params }) {
  return <LiveDealInvestorRuntime id={params.dealId} />;
}
