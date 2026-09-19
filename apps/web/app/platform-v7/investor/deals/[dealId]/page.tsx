import { redirect } from 'next/navigation';

export default async function InvestorDealPage(props: { params: Promise<{ dealId: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/deals/${encodeURIComponent(params.dealId)}`);
}
