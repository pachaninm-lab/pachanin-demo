import Link from 'next/link';

export function CompanyProfileActions({ companyId }: { companyId: string }) {
  return (
    <div className="cta-stack">
      <Link href={`/companies/${companyId}`} className="primary-link">Открыть профиль</Link>
      <Link href="/finance" className="secondary-link">Финконтур</Link>
      <Link href="/documents" className="secondary-link">Документы</Link>
      <Link href="/support" className="secondary-link">Support</Link>
    </div>
  );
}
