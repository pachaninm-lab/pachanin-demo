import type { ReactNode } from 'react';

// ContactCopyNormalizer размонтирован: он безусловно штамповал русскую копию
// поверх DOM и ломал EN/ZH. Его формулировки перенесены в
// apps/web/messages/*.json (namespace `contact`) и рендерятся через next-intl.
export default function PlatformV7ContactTemplate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
