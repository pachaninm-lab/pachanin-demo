'use client';

import { usePathname } from 'next/navigation';
import { DecisionPackMiniPanel } from './DecisionPackMiniPanel';
import type { DecisionPackContext } from '@/lib/platform-v7/document-money-decision-pack';

export function DecisionPackRoutePlacement({
  route,
  context,
}: {
  route: string;
  context: DecisionPackContext;
}) {
  const pathname = usePathname();

  if (normalizePath(pathname) !== normalizePath(route)) {
    return null;
  }

  return <DecisionPackMiniPanel context={context} />;
}

function normalizePath(path: string | null) {
  const normalized = (path ?? '').replace(/\/+$/, '');
  return normalized || '/';
}
