import {
  AuctionPostgresAuthorityWorkspace,
  getAuctionAuthorityMetadata,
} from '@/components/transaction-ux/AuctionPostgresAuthorityWorkspace';
import { MarketOpenLotsPanel } from '@/components/platform-v7/MarketOpenLotsPanel';

export const generateMetadata = () => getAuctionAuthorityMetadata('overview');

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default async function PlatformV7AuctionPage(
  props: {
    searchParams?: Promise<{ lotId?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  const lotId = firstParam(searchParams?.lotId);
  return (
    <>
      {/* Обезличенная витрина всех открытых лотов платформы — показывается на
          обзоре торгов; при выбранном лоте пользователь работает с его окном. */}
      {!lotId ? (
        <div style={{ margin: '0 0 var(--ds-space-4)' }}>
          <MarketOpenLotsPanel />
        </div>
      ) : null}
      <AuctionPostgresAuthorityWorkspace stage='overview' lotId={lotId} />
    </>
  );
}
