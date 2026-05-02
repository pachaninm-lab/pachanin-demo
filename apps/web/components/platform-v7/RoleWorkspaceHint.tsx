import Link from 'next/link';

export type RoleWorkspaceHintProps = {
  readonly label: string;
  readonly href: string;
  readonly description: string;
};

export function RoleWorkspaceHint({ label, href, description }: RoleWorkspaceHintProps) {
  return (
    <aside data-testid="platform-v7-role-workspace-hint" style={{ border: '1px solid #DDE7F0', background: '#F8FBFF', borderRadius: 14, padding: 14, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0F1419' }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: '#64748B' }}>{description}</div>
      </div>
      <Link href={href} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', textDecoration: 'none', fontSize: 12, fontWeight: 900 }}>
        Открыть экран
      </Link>
    </aside>
  );
}
