import { redirect } from 'next/navigation';
import { LotDetailRuntime } from '@/components/v7r/LotDetailRuntime';

export default function Page({ params }: { params: { lotId: string } }) {
  if (params.lotId === 'new' || params.lotId === 'create') {
    redirect('/platform-v7/lots/create');
  }
  return <LotDetailRuntime id={params.lotId} />;
}
