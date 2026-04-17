import { LotDetailRuntime } from '@/components/v7r/LotDetailRuntime';

export default function PlatformV7LotAliasPage({ params }: { params: { id: string } }) {
  return <LotDetailRuntime id={params.id} />;
}
