import { SupportParticipantAuthority, getSupportAuthorityMetadata } from '@/components/transaction-ux/SupportParticipantAuthority';

export function generateMetadata() {
  return getSupportAuthorityMetadata('operator');
}

export default function SupportOperatorPage() {
  return <SupportParticipantAuthority mode='operator' />;
}
