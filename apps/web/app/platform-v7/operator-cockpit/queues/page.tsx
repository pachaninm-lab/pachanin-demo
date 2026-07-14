import { redirect } from 'next/navigation';
import { PLATFORM_V7_OPERATOR_ROUTE } from '@/lib/platform-v7/routes';

export default function PlatformV7OperatorQueuesPage() {
  redirect(PLATFORM_V7_OPERATOR_ROUTE);
}
