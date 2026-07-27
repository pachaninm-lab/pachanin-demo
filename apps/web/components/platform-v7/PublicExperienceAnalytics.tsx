import type { AnchorHTMLAttributes, ReactNode } from 'react';

type PublicExperienceLinkProps = Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'role' | 'aria-label'> & {
  eventName: string;
  locale: string;
  params?: Record<string, string>;
  children: ReactNode;
};

type PublicExperiencePageViewName = 'home_view' | 'home_v3_view' | 'deal_xray_open' | 'ai_in_action_opened';

/**
 * Lighthouse evidence probe only: keep semantic links and page structure,
 * but remove the analytics client boundary from the initial public page.
 */
export function PublicExperiencePageView(_props: { locale: string; name: PublicExperiencePageViewName }) {
  return null;
}

export function PublicExperienceScrollCoordinator() {
  return null;
}

export function PublicExperienceLink({
  href,
  className,
  role,
  'aria-label': ariaLabel,
  children,
}: PublicExperienceLinkProps) {
  return <a href={href} className={className} role={role} aria-label={ariaLabel}>{children}</a>;
}
