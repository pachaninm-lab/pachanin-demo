import type { Metadata } from 'next';
import { AuctionServerAuthorityWorkspace } from '@/components/transaction-ux/AuctionServerAuthorityWorkspace';

export const metadata: Metadata = {
  title: 'Основание Сделки из аукциона',
  description: 'Переход победителя в каноническую Сделку только по server-issued dealId.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionDealBasisPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionServerAuthorityWorkspace stage='deal-basis' lotId={firstParam(searchParams?.lotId)} />;
}
