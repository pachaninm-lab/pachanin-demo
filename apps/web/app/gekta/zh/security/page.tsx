import type { Metadata } from 'next';
import { GektaUtilityMobileStyle } from '@/components/gekta/GektaUtilityMobileStyle';
import { GektaUtilityPage } from '@/components/gekta/GektaUtilityPage';

export const metadata: Metadata = {
  title: '数据与安全 — Gekta',
  description: 'Gekta 如何处理本地历史、秘密信息、AI 限制以及面向用户的数据边界。',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/gekta/zh/security' },
};

export default function GektaChineseSecurityPage() {
  return <><GektaUtilityMobileStyle /><GektaUtilityPage locale='zh' kind='security' /></>;
}
