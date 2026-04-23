import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PlatformRolesHub } from '@/components/v7r/PlatformRolesHub';

const ROLE_ROUTES = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
} as const;

type PlatformRole = keyof typeof ROLE_ROUTES;

export default async function PlatformV7RootPage({
  searchParams,
}: {
  searchParams?: { entry?: string };
}) {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get('pc-role')?.value as PlatformRole | undefined;
  const hasChosenRole = rawRole && rawRole in ROLE_ROUTES;

  if (hasChosenRole && searchParams?.entry !== '1') {
    redirect(ROLE_ROUTES[rawRole]);
  }

  return <PlatformRolesHub />;
}
