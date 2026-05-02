import { redirect } from 'next/navigation';

export default function PlatformV7DealDetailPage({ params }: { params: { id: string } }) {
  redirect(`/platform-v7/deals/${params.id}/clean`);
}
