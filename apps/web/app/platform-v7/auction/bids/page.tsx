import type { Metadata } from 'next';
import { AuctionServerAuthorityWorkspace } from '@/components/transaction-ux/AuctionServerAuthorityWorkspace';

export const metadata: Metadata = {
  title: 'Ставки аукциона',
  description: 'Read-only агрегаты серверного журнала ставок без локального выбора победителя.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionBidsPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionServerAuthorityWorkspace stage='bids' lotId={firstParam(searchParams?.lotId)} />;
}
