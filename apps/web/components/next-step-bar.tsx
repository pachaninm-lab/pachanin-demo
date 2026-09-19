import Link from 'next/link';

export function NextStepBar({
  title,
  detail,
  primary,
  secondary
}: {
  title: string;
  detail?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string }[];
}) {
  return (
    <div className="sticky-action-bar">
      <div className="min-w-0">
        <div className="eyebrow">Следующий шаг</div>
        <div className="font-semibold mt-1" style={{ color: 'var(--text)' }}>{title}</div>
        {detail ? <div className="muted tiny" style={{ marginTop: 4 }}>{detail}</div> : null}
      </div>
      <div className="cta-stack">
        {primary ? <Link href={primary.href} className="primary-link !py-2 !px-4 text-sm">{primary.label}</Link> : null}
        {secondary?.map((item) => <Link key={item.href} href={item.href} className="secondary-link !py-2 !px-4 text-sm">{item.label}</Link>)}
      </div>
    </div>
  );
}
