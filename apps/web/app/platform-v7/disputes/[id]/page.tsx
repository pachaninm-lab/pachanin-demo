import { redirect } from 'next/navigation';

export default function PlatformV7DisputeDetailPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/disputes?disputeId=${encodeURIComponent(params.id)}`);
}
