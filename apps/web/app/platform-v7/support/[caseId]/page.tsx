import { SupportParticipantAuthority, getSupportAuthorityMetadata } from '@/components/transaction-ux/SupportParticipantAuthority';

export function generateMetadata() {
  return getSupportAuthorityMetadata('detail');
}

export default async function SupportCasePage({ params }: { params: Promise<{ caseId: string }> | { caseId: string } }) {
  const { caseId } = await Promise.resolve(params);
  return <SupportParticipantAuthority mode='detail' caseId={caseId} />;
}
