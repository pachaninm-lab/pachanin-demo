import { redirect } from 'next/navigation';
import { PLATFORM_V7_EXECUTION_MAP_ROUTE } from '@/lib/platform-v7/routes';

export default function PlatformV7DomainCorePage() {
  redirect(PLATFORM_V7_EXECUTION_MAP_ROUTE);
}
