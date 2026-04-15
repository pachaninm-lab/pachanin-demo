import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default function LegacyPlatformV7RRolesLayout({ children }: { children: ReactNode }) {
  void children;
  redirect('/platform-v7');
}
