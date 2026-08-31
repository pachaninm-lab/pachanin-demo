import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: 'Данные и безопасность — Гекта',
  description: 'Как Гекта работает с локальной историей, секретами, ограничениями ИИ и пользовательскими данными.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/security' },
};

export default function GektaSecurityPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='ru' kind='security' /></>;
}
