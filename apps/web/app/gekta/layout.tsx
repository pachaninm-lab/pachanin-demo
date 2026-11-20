import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { GektaAppearance } from '@/components/gekta/GektaAppearance';
import { GEKTA_THEME_BOOTSTRAP, GEKTA_THEME_COLORS } from '@/lib/gekta/appearance';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: GEKTA_THEME_COLORS.light,
};

export default function GektaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GEKTA_THEME_BOOTSTRAP }} />
      <GektaAppearance>{children}</GektaAppearance>
    </>
  );
}
