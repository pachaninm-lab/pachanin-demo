import Link from 'next/link';
import type { ReactNode } from 'react';
import { PremiumIcon, type PremiumGlyph } from './icons';

type Variant = 'primary' | 'ghost' | 'danger';

function variantClass(variant: Variant): string {
  if (variant === 'ghost') return 'pc-prem-cta pc-prem-cta--ghost';
  if (variant === 'danger') return 'pc-prem-cta pc-prem-cta--danger';
  return 'pc-prem-cta';
}

export function PremiumCtaButton({
  children,
  href,
  onClick,
  type = 'button',
  variant = 'primary',
  glyph,
  icon,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: Variant;
  glyph?: PremiumGlyph;
  icon?: ReactNode;
}) {
  const className = variantClass(variant);
  const inner = (
    <>
      {icon ?? (glyph ? <PremiumIcon glyph={glyph} /> : null)}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={className} onClick={onClick}>
      {inner}
    </button>
  );
}
