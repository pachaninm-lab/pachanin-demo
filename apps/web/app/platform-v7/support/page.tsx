import { SupportParticipantAuthority, getSupportAuthorityMetadata } from '@/components/transaction-ux/SupportParticipantAuthority';

export function generateMetadata() {
  return getSupportAuthorityMetadata('index');
}

export default function SupportPage() {
  return <SupportParticipantAuthority mode='index' />;
}
