import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

type PlatformPublicHeaderMode = 'public' | 'login' | 'back';

type PlatformPublicHeaderProps = {
  mode?: PlatformPublicHeaderMode;
  rightHref?: string;
  rightLabel?: string;
  backLabel?: string;
  brandLabel?: string;
  className?: string;
};

export function PlatformPublicHeader({
  mode = 'public',
  rightHref,
  rightLabel,
  backLabel = 'Назад',
  brandLabel = 'Прозрачная Цена',
  className = '',
}: PlatformPublicHeaderProps) {
  const showLogin = mode === 'public';
  const href = showLogin ? (rightHref ?? '/platform-v7/login') : (rightHref ?? '/platform-v7');
  const label = showLogin ? (rightLabel ?? 'Войти') : backLabel;

  return (
    <header className={`pc-platform-public-header ${className}`.trim()} data-platform-public-header>
      <Link className="pc-platform-public-header__brand" href="/platform-v7" aria-label={brandLabel}>
        <span className="pc-platform-public-header__mark" aria-hidden="true">
          <img src={BRAND_LOGO_DATA_URI} alt="" draggable={false} />
        </span>
        <strong>{brandLabel}</strong>
      </Link>

      <Link
        className={showLogin ? 'pc-platform-public-header__login' : 'pc-platform-public-header__back'}
        href={href}
        aria-label={label}
        title={label}
      >
        {showLogin ? <span>{label}</span> : <ArrowLeft size={24} strokeWidth={2.45} aria-hidden="true" />}
        {showLogin ? <LogIn size={18} strokeWidth={2.35} aria-hidden="true" /> : null}
      </Link>
    </header>
  );
}
