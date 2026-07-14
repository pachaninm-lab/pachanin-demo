import { SupportParticipantAuthority, getSupportAuthorityMetadata } from '@/components/transaction-ux/SupportParticipantAuthority';

export function generateMetadata() {
  return getSupportAuthorityMetadata('new');
}

export default function SupportNewPage() {
  return <SupportParticipantAuthority mode='new' />;
}
