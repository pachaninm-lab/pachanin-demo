import type { ReactNode } from 'react';
import { LoginHeaderExitButton } from '@/components/platform-v7/LoginHeaderExitButton';

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LoginHeaderExitButton />
      {children}
    </>
  );
}
