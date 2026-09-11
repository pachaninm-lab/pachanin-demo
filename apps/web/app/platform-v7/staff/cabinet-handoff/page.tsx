import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OwnerCabinetHandoff } from '@/components/platform-v7/staff/OwnerCabinetHandoff';
import { controlledOrganizationById } from '@/lib/platform-v7/controlled-test-organizations';
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

function signingSecret(): string | null {
  const candidate = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  return candidate.length >= 32 && candidate.length <= 4096 ? candidate : null;
}

function handoffTarget(role: PlatformRole): string {
  switch (role) {
    case 'operator': return '/platform-v7/operator';
    case 'buyer': return '/platform-v7/buyer';
    case 'seller': return '/platform-v7/seller';
    case 'logistics': return '/platform-v7/logistics';
    case 'driver': return '/platform-v7/driver/field';
    case 'surveyor': return '/platform-v7/surveyor';
    case 'elevator': return '/platform-v7/elevator';
    case 'lab': return '/platform-v7/lab';
    case 'bank': return '/platform-v7/bank';
    case 'arbitrator': return '/platform-v7/arbitrator';
    case 'compliance': return '/platform-v7/compliance';
    case 'executive': return '/platform-v7/executive';
  }
}

export default async function OwnerCabinetHandoffPage() {
  const secret = signingSecret();
  const token = (await cookies()).get(CABINET_SESSION_COOKIE)?.value ?? '';
  const context = secret && token && token.length <= 8192
    ? await readVerifiedCabinetSessionContext(token, secret, Math.floor(Date.now() / 1000))
    : null;

  if (!context) redirect('/platform-v7/staff?cabinetError=CABINET_SESSION_UNAVAILABLE');
  if (context.role === 'organization') {
    redirect('/platform-v7/staff?cabinetError=ORGANIZATION_CABINET_NOT_CONTROLLED');
  }

  const target = handoffTarget(context.role);
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
