import Link from 'next/link';

export function LotActions({ lotId }: { lotId: string }) {
  return (
    <div className="cta-stack">
      <Link href={`/lots/${lotId}`} className="primary-link">Открыть лот</Link>
      <Link href="/auctions" className="secondary-link">Торги</Link>
      <Link href="/documents" className="secondary-link">Документы</Link>
    </div>
  );
}
