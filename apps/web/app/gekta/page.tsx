import type { Metadata } from 'next';
import { GektaProductShell } from '@/components/gekta/GektaProductShell';
import { getGektaMetadata } from '@/lib/gekta/seo';

export const metadata: Metadata = getGektaMetadata('ru');

export default function GektaPage() {
  return <GektaProductShell locale='ru' />;
}
