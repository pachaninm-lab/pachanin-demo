import { redirect } from 'next/navigation';

export default function CounterpartyPage({ params }: { params: { counterpartyId: string } }) {
  redirect(`/platform-v7/compliance?counterpartyId=${encodeURIComponent(params.counterpartyId)}`);
}
