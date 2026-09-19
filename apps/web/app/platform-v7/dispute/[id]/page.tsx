import { redirect } from 'next/navigation';
import { PLATFORM_V7_CANONICAL_ROUTES } from '@/lib/platform-v7/route-canonicalization';

export default async function PlatformV7DisputeAliasPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`${PLATFORM_V7_CANONICAL_ROUTES.disputes}/${params.id}`);
}
