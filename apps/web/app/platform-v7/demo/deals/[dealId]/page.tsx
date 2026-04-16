import { LiveDealInvestorRuntime } from '@/components/v7r/LiveDealInvestorRuntime';

export default function DemoDealPage({ params }) {
  return <LiveDealInvestorRuntime id={params.dealId} />;
}
