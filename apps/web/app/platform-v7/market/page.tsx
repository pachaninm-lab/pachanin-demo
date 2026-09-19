import { redirect } from 'next/navigation';
import { PLATFORM_V7_CANONICAL_ROUTES } from '@/lib/platform-v7/route-canonicalization';

export default function PlatformV7MarketAliasPage() {
  redirect(PLATFORM_V7_CANONICAL_ROUTES.lots);
}
