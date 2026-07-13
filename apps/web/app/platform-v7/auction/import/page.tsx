import type { Metadata } from 'next';
import { AuctionServerAuthorityWorkspace } from '@/components/transaction-ux/AuctionServerAuthorityWorkspace';

export const metadata: Metadata = {
  title: 'Импорт лота в аукцион',
  description: 'Проверка серверного источника лота и границы внешнего подтверждения ФГИС/СДИЗ.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

export default function AuctionImportPage({ searchParams }: { searchParams?: { lotId?: string | string[] } }) {
  return <AuctionServerAuthorityWorkspace stage='import' lotId={firstParam(searchParams?.lotId)} />;
}
