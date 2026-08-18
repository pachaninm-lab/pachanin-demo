import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: 'Поддержка — Гекта',
  description: 'Поддержка Гекты: вопросы по интерфейсу, доступу, техническим проблемам и подключению без перехода в другой интерфейс.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/support' },
};

export default function GektaSupportPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='ru' kind='support' /></>;
}
