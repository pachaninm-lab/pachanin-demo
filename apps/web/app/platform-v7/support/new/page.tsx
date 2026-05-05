import type { Metadata } from 'next';
import { SupportNewCaseClient } from '@/components/platform-v7/SupportNewCaseClient';
import type { SupportCase, SupportRelatedEntityType } from '@/lib/platform-v7/support-types';

export const metadata: Metadata = {
  title: 'Создать обращение',
  description: 'Создание обращения по сделке, документу, рейсу или блокеру.',
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupportNewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const params = await Promise.resolve(searchParams ?? {});
  const context = one(params.context);
  const dealId = one(params.dealId);
  const lotId = one(params.lotId);
  const tripId = one(params.tripId);
  const entity = one(params.entity) as SupportRelatedEntityType | undefined;
  const entityId = one(params.entityId);
  const blocker = one(params.blocker);
  const money = one(params.moneyAtRiskRub);

  const defaults: Partial<SupportCase> = {
    title: context === 'document' ? 'Проблема с документом' : context === 'trip' ? 'Проблема с рейсом' : context === 'blocker' ? 'Обращение по блокеру' : dealId ? 'Нужна помощь по сделке' : '',
    description: context === 'document' ? 'Нужно проверить документный пакет и понять, что мешает продолжить сделку.' : context === 'trip' ? 'Нужно проверить рейс, маршрут, подтверждения и следующий шаг.' : context === 'blocker' ? 'Нужно проверить блокер и определить ответственного.' : '',
    relatedEntityType: entity ?? (tripId ? 'trip' : dealId ? 'deal' : lotId ? 'lot' : 'other'),
    relatedEntityId: entityId ?? tripId ?? dealId ?? lotId,
    dealId,
    lotId,
    tripId,
    blocker,
    moneyAtRiskRub: money ? Number(money) : 0,
  };

  return <SupportNewCaseClient defaults={defaults} />;
}
