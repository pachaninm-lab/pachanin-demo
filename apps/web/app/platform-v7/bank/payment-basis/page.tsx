import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

type PageSearchParams = { dealId?: string | string[]; shipmentId?: string | string[] };

export const metadata: Metadata = {
  title: 'Проверка основания выплаты · Прозрачная Цена',
  description: 'Канонический вход в серверную проверку основания выплаты по конкретной Сделке.',
  robots: { index: false, follow: false },
};

export default function BankPaymentBasisPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = new URLSearchParams();
  const dealId = firstParam(searchParams?.dealId);
  const shipmentId = firstParam(searchParams?.shipmentId);
  if (dealId) query.set('dealId', dealId);
  if (shipmentId) query.set('shipmentId', shipmentId);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  redirect(`/platform-v7/bank/release-safety${suffix}`);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}
