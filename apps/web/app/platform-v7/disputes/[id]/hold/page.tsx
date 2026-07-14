import { redirect } from 'next/navigation';

export default function PlatformV7DisputeHoldPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/disputes?disputeId=${encodeURIComponent(params.id)}&view=hold`);
}
