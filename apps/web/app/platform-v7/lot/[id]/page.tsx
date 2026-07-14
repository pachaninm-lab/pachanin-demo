import { redirect } from 'next/navigation';

export default function PlatformV7LotByIdAliasPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/auction?lotId=${encodeURIComponent(params.id)}`);
}
