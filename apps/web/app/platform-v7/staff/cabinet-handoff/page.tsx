import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OwnerCabinetHandoff } from '@/components/platform-v7/staff/OwnerCabinetHandoff';
import { controlledOrganizationById } from '@/lib/platform-v7/controlled-test-organizations';
import { ownerControlledCabinetTarget } from '@/lib/platform-v7/control-host';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import { readVerifiedCabinetSessionContext } from '@/lib/platform-v7/verified-session';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Открываем кабинет — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

const LABELS: Readonly<Record<PlatformRole, string>> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

function signingSecret(): string {
  return String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
}

export default async function OwnerCabinetHandoffPage() {
  const secret = signingSecret();
  const token = (await cookies()).get(CABINET_SESSION_COOKIE)?.value ?? '';
  if (
    secret.length < 32
    || secret.length > 4096
    || token.length === 0
    || token.length > 8192
  ) {
    redirect('/platform-v7/staff?cabinetError=CABINET_SESSION_UNAVAILABLE');
  }

  const context = await readVerifiedCabinetSessionContext(token, secret, Math.floor(Date.now() / 1000));
  if (!context) redirect('/platform-v7/staff?cabinetError=CABINET_SESSION_UNAVAILABLE');
  if (context.role === 'organization') {
    redirect('/platform-v7/staff?cabinetError=ORGANIZATION_CABINET_NOT_CONTROLLED');
  }

  const target = ownerControlledCabinetTarget(context.role);
  if (!target) redirect('/platform-v7/staff?cabinetError=INVALID_CABINET_ROLE');

  const organization = controlledOrganizationById(context.organizationId);
  return (
    <OwnerCabinetHandoff
      role={context.role}
      target={target}
      label={LABELS[context.role]}
      organizationName={organization?.name || null}
      testData={organization?.testData === true}
    />
  );
}
