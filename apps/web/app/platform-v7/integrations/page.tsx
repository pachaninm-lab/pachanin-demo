import { redirect } from 'next/navigation';
import { PLATFORM_V7_CANONICAL_ROUTES } from '@/lib/platform-v7/route-canonicalization';

export default function PlatformV7IntegrationsAliasPage() {
  redirect(PLATFORM_V7_CANONICAL_ROUTES.connectors);
}
