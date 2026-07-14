import { redirect } from 'next/navigation';

export default function PlatformV7DealDraftDetailPage({ params }: { params: { draftId: string } }) {
  redirect(`/platform-v7/auction/deal-basis?legacyDraftId=${encodeURIComponent(params.draftId)}`);
}
