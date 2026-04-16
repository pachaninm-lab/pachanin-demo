import { DealDraftDetailRuntimeV2 } from '@/components/v7r/DealDraftDetailRuntimeV2';

export default function PlatformV7DealDraftDetailPage({ params }: { params: { draftId: string } }) {
  return <DealDraftDetailRuntimeV2 id={params.draftId} />;
}
