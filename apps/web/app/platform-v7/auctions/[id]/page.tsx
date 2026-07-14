import { redirect } from 'next/navigation';

export default function PlatformV7AuctionByIdAliasPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/auction?lotId=${encodeURIComponent(params.id)}`);
}
