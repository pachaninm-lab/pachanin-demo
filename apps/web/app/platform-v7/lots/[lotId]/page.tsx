import { LotDetailRuntime } from '@/components/v7r/LotDetailRuntime';

export default function Page({ params }: { params: { lotId: string } }) {
  return <LotDetailRuntime id={params.lotId} />;
}
