import {
  AuctionPostgresAuthorityWorkspace,
  getAuctionAuthorityMetadata,
} from '@/components/transaction-ux/AuctionPostgresAuthorityWorkspace';

export const generateMetadata = () => getAuctionAuthorityMetadata('deal-basis');

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionDealBasisPage({
  searchParams,
}: {
  searchParams?: { lotId?: string | string[] };
}) {
  return (
    <AuctionPostgresAuthorityWorkspace
      stage='deal-basis'
      lotId={firstParam(searchParams?.lotId)}
    />
  );
}
