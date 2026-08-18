import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: 'Support — Gekta',
  description: 'Gekta support for interface, access, technical and onboarding questions without leaving the Gekta surface.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/en/support' },
};

export default function GektaEnglishSupportPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='en' kind='support' /></>;
}
