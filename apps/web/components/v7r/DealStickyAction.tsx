'use client';

import * as React from 'react';
import Link from 'next/link';

export function DealStickyAction({ title, href, label, observeId = 'deal-primary-action' }: { title: string; href: string; label: string; observeId?: string }) {
  const [hideSticky, setHideSticky] = React.useState(false);

  React.useEffect(() => {
    const target = document.getElementById(observeId);
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setHideSticky(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.35 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [observeId]);

  if (hideSticky) return null;

  return (
    <div className="sticky-action">
      <div className="sticky-inner">
        <div>
          <div className="sticky-label">Следующее действие</div>
          <div className="sticky-title">{title}</div>
        </div>
        <Link href={href} className="btn btn-primary">{label}</Link>
      </div>
    </div>
  );
}
