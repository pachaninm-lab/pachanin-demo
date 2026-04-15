import { AuctionDetailPage } from '@/components/v7r/EsiaFgisRuntime';

export default function PlatformV7AuctionDetailPage({ params }: { params: { id: string } }) {
  return <AuctionDetailPage id={params.id} />;
}
