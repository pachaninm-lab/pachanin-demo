import { redirect } from 'next/navigation';

export default async function CounterpartyPage(props: { params: Promise<{ counterpartyId: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/compliance?counterpartyId=${encodeURIComponent(params.counterpartyId)}`);
}
