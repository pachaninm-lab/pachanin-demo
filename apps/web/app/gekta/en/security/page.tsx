import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: 'Data and security — Gekta',
  description: 'How Gekta handles local history, secrets, AI limits and user-facing data boundaries.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/en/security' },
};

export default function GektaEnglishSecurityPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='en' kind='security' /></>;
}
