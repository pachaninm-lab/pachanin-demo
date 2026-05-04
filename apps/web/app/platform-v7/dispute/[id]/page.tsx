import { redirect } from 'next/navigation';
import { PLATFORM_V7_CANONICAL_ROUTES } from '@/lib/platform-v7/route-canonicalization';

export default function PlatformV7DisputeAliasPage({ params }: { params: { id: string } }) {
  redirect(`${PLATFORM_V7_CANONICAL_ROUTES.disputes}/${params.id}`);
}
