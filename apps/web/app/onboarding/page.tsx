import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

export default function OnboardingPage() {
  return (
    <AppShell title="Onboarding" subtitle="Допуск компаний: KYC/KYB, signer authority, docs completeness and trust">
      <div className="stack-sm">
        <Link href="/onboarding/company" className="secondary-link">Company onboarding</Link>
        <Link href="/onboarding/user" className="secondary-link">User onboarding</Link>
      </div>
    </AppShell>
  );
}
