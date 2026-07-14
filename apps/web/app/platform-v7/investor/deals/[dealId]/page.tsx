import { redirect } from 'next/navigation';

export default function InvestorDealPage({ params }: { params: { dealId: string } }) {
  redirect(`/platform-v7/deals/${encodeURIComponent(params.dealId)}`);
}
