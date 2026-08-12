import type { Metadata } from 'next';
import { GektaProductShell } from '@/components/gekta/GektaProductShell';
import { getGektaMetadata } from '@/lib/gekta/seo';

export const metadata: Metadata = getGektaMetadata('zh');

export default function GektaChinesePage() {
  return <GektaProductShell locale='zh' />;
}
