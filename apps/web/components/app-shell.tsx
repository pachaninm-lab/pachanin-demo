import { ReactNode } from 'react';
import { PageFrame } from './page-frame';

export function AppShell({ title, subtitle, children, breadcrumbs, actions }: { title: string; subtitle?: string; children?: ReactNode; breadcrumbs?: ReactNode; actions?: ReactNode }) {
  return (
    <PageFrame title={title} subtitle={subtitle} breadcrumbs={breadcrumbs} actions={actions}>
      {children}
    </PageFrame>
  );
}
