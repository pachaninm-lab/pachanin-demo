import { DealReadinessPage } from '@/components/v7r/EsiaFgisRuntime';

export default function PlatformV7DealReadinessPage({ params }: { params: { dealId: string } }) {
  return <DealReadinessPage id={params.dealId} />;
}
