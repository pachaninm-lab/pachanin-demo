import type { ReactNode } from 'react';
import { LoginRestorePatch } from '@/components/platform-v7/LoginRestorePatch';

export default function LoginTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <LoginRestorePatch />
      {children}
    </>
  );
}
