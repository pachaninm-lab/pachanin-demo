import { redirect } from 'next/navigation';
import { PLATFORM_V7_BUYER_RFQ_NEW_ROUTE } from '@/lib/platform-v7/routes';

export default function BuyerRfqCreatePage() {
  redirect(PLATFORM_V7_BUYER_RFQ_NEW_ROUTE);
}
