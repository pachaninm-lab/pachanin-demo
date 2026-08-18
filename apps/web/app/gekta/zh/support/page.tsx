import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: '支持 — Gekta',
  description: 'Gekta 支持：界面、访问、技术和接入问题，无需离开 Gekta 界面。',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/zh/support' },
};

export default function GektaChineseSupportPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='zh' kind='support' /></>;
}
