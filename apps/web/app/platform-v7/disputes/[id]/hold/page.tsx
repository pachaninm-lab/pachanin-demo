import { redirect } from 'next/navigation';

export default async function PlatformV7DisputeHoldPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/disputes?disputeId=${encodeURIComponent(params.id)}&view=hold`);
}
