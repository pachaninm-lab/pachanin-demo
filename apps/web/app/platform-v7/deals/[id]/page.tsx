import { DealReadinessPage } from '@/components/v7r/EsiaFgisRuntime';

export default function PlatformV7DealReadinessPage({ params }: { params: { id: string } }) {
  return <DealReadinessPage id={params.id} />;
}
