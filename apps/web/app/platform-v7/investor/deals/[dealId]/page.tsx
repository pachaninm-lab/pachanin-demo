import { LiveDealInvestorRuntime } from '@/components/v7r/LiveDealInvestorRuntime';

export default function Page({ params }) {
  return <LiveDealInvestorRuntime id={params.dealId} />;
}
