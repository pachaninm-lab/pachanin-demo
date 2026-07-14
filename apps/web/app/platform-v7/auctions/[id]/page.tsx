import { redirect } from 'next/navigation';

export default function PlatformV7AuctionDetailPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/auction?legacyAuctionId=${encodeURIComponent(params.id)}`);
}
