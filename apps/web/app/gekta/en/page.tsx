import type { Metadata } from 'next';
import { GektaProductShell } from '@/components/gekta/GektaProductShell';
import { getGektaMetadata } from '@/lib/gekta/seo';

export const metadata: Metadata = getGektaMetadata('en');

export default function GektaEnglishPage() {
  return <GektaProductShell locale='en' />;
}
