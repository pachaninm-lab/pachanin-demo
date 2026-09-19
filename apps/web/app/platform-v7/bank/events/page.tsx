import { redirect } from 'next/navigation';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

export default function PlatformV7BankEventsPage() {
  redirect(PLATFORM_V7_BANK_ROUTE);
}
