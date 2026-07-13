import type { Metadata } from 'next';
import {
  AuctionPostgresAuthorityWorkspace,
  getAuctionAuthorityMetadata,
} from '@/components/transaction-ux/AuctionPostgresAuthorityWorkspace';

export async function generateMetadata(): Promise<Metadata> {
  return getAuctionAuthorityMetadata('overview');
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function PlatformV7AuctionPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionPostgresAuthorityWorkspace stage='overview' lotId={firstParam(searchParams?.lotId)} />;
}
