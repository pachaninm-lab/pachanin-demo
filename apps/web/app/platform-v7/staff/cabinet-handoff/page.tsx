import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OwnerCabinetHandoff } from '@/components/platform-v7/staff/OwnerCabinetHandoff';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import { readVerifiedCabinetSessionRole } from '@/lib/platform-v7/verified-session';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Открываем кабинет — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

const TARGETS: Readonly<Record<PlatformRole, string>> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
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
  const token = cookies().get(CABINET_SESSION_COOKIE)?.value;
  const role = secret
    ? await readVerifiedCabinetSessionRole(token, secret, Math.floor(Date.now() / 1000))
    : null;

  if (!role) redirect('/platform-v7/staff?cabinetError=CABINET_SESSION_UNAVAILABLE');

  return <OwnerCabinetHandoff role={role} target={TARGETS[role]} label={LABELS[role]} />;
}
