import { redirect } from 'next/navigation';

export default async function PlatformV7LotByIdAliasPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/auction?lotId=${encodeURIComponent(params.id)}`);
}
