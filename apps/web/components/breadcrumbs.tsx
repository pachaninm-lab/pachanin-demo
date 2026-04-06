import Link from 'next/link';

export type BreadcrumbItem = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items?.length) return null;
  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !last ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
            {!last ? <span>›</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
