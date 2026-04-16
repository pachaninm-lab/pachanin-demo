import { DealDraftDetailRuntime } from '@/components/v7r/DealDraftDetailRuntime';

export default function PlatformV7DealDraftDetailPage({ params }: { params: { draftId: string } }) {
  return <DealDraftDetailRuntime id={params.draftId} />;
}
