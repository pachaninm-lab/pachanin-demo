import { redirect } from 'next/navigation';

export default async function PlatformV7DealDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/deals/${params.id}/clean`);
}
