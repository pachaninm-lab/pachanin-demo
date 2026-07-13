import type { Metadata } from 'next';
import { AuctionServerAuthorityWorkspace } from '@/components/transaction-ux/AuctionServerAuthorityWorkspace';

export const metadata: Metadata = {
  title: 'Аукцион',
  description: 'Серверно подтверждённый контур лота, допуска, ставок и перехода победителя в каноническую Сделку.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function PlatformV7AuctionPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionServerAuthorityWorkspace stage='overview' lotId={firstParam(searchParams?.lotId)} />;
}
