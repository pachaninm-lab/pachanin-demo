import type { Metadata } from 'next';
import { SupportNewCaseScopedClient } from '@/components/platform-v7/SupportNewCaseScopedClient';
import type { SupportCase, SupportRelatedEntityType } from '@/lib/platform-v7/support-types';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const metadata: Metadata = {
  title: 'Создать обращение',
  description: 'Создание обращения по сделке, документу, рейсу, блокеру или консультации.',
};

const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asRole(value: string | undefined): PlatformRole | undefined {
  return value && roles.includes(value as PlatformRole) ? (value as PlatformRole) : undefined;
}

export default async function SupportNewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const params = await Promise.resolve(searchParams ?? {});
  const context = one(params.context);
  const role = asRole(one(params.role));
  const dealId = one(params.dealId);
  const lotId = one(params.lotId);
  const tripId = one(params.tripId);
  const entity = one(params.entity) as SupportRelatedEntityType | undefined;
  const entityId = one(params.entityId);
  const blocker = one(params.blocker);
  const money = one(params.moneyAtRiskRub);
  const isConsultation = context === 'consultation';

  const defaults: Partial<SupportCase> = {
    requesterRole: role,
    title: isConsultation ? 'Запросить консультацию' : context === 'document' ? 'Проблема с документом' : context === 'trip' ? 'Проблема с рейсом' : context === 'blocker' ? 'Обращение по блокеру' : dealId ? 'Нужна помощь по сделке' : '',
    description: isConsultation ? 'Нужно связаться с менеджером по платформе, пилоту, подключению организации или рабочему сценарию сделки.' : context === 'document' ? 'Нужно проверить документный пакет и понять, что мешает продолжить сделку.' : context === 'trip' ? 'Нужно проверить рейс, маршрут, подтверждения и следующий шаг.' : context === 'blocker' ? 'Нужно проверить блокер и определить ответственного.' : '',
    relatedEntityType: isConsultation ? 'other' : entity ?? (tripId ? 'trip' : dealId ? 'deal' : lotId ? 'lot' : 'other'),
    relatedEntityId: isConsultation ? 'CONSULTATION' : entityId ?? tripId ?? dealId ?? lotId,
    dealId,
    lotId,
    tripId,
    blocker: isConsultation ? 'Требуется консультация менеджера' : blocker,
    moneyAtRiskRub: money ? Number(money) : 0,
  };

  return <SupportNewCaseScopedClient defaults={defaults} />;
}
