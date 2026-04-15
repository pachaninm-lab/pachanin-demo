import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default function LegacyPlatformV7RTemplate({ children }: { children: ReactNode }) {
  void children;
  redirect('/platform-v7');
}
