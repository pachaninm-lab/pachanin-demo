import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { AuctionAuthorityRoute } from '@/components/transaction-ux/AuctionAuthorityRoute';
import { getAuctionAuthorityRouteCopy, normalizeAuctionLocale } from '@/lib/platform-v7/auctionAuthorityCopy';

export async function generateMetadata(): Promise<Metadata> {
  const copy = getAuctionAuthorityRouteCopy('overview', normalizeAuctionLocale(await getLocale()));
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function PlatformV7AuctionPage() {
  const copy = getAuctionAuthorityRouteCopy('overview', normalizeAuctionLocale(await getLocale()));
  return <AuctionAuthorityRoute testId='platform-v7-auction-authority-v8' {...copy} />;
}
