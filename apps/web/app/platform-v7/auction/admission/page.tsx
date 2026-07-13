import type { Metadata } from 'next';
import { AuctionServerAuthorityWorkspace } from '@/components/transaction-ux/AuctionServerAuthorityWorkspace';

export const metadata: Metadata = {
  title: 'Допуск к торгам',
  description: 'Серверные блокеры и готовность лота до открытия ценового окна.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionAdmissionPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionServerAuthorityWorkspace stage='admission' lotId={firstParam(searchParams?.lotId)} />;
}
