import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { AuctionAuthorityRoute } from '@/components/transaction-ux/AuctionAuthorityRoute';
import { getAuctionAuthorityRouteCopy, normalizeAuctionLocale } from '@/lib/platform-v7/auctionAuthorityCopy';

export async function generateMetadata(): Promise<Metadata> {
  const copy = getAuctionAuthorityRouteCopy('import', normalizeAuctionLocale(await getLocale()));
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function AuctionImportPage() {
  const copy = getAuctionAuthorityRouteCopy('import', normalizeAuctionLocale(await getLocale()));
  return <AuctionAuthorityRoute testId='platform-v7-auction-import-authority-v8' {...copy} />;
}
