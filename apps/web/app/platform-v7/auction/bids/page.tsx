import {
  AuctionPostgresAuthorityWorkspace,
  getAuctionAuthorityMetadata,
} from '@/components/transaction-ux/AuctionPostgresAuthorityWorkspace';

export const generateMetadata = () => getAuctionAuthorityMetadata('bids');

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionBidsPage({
  searchParams,
}: {
  searchParams?: { lotId?: string | string[] };
}) {
  return (
    <AuctionPostgresAuthorityWorkspace
      stage='bids'
      lotId={firstParam(searchParams?.lotId)}
    />
  );
}
