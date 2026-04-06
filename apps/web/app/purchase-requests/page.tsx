import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

export default function PurchaseRequestsPage() {
  return (
    <AppShell title="Purchase requests" subtitle="Спрос покупателей, целевые заявки и конвертация в торги/сделки">
      <div className="stack-sm">
        <Link href="/purchase-requests/REQ-001" className="secondary-link">REQ-001</Link>
        <Link href="/purchase-requests/REQ-002" className="secondary-link">REQ-002</Link>
      </div>
    </AppShell>
  );
}
