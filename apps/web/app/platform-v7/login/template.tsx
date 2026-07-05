import type { ReactNode } from 'react';
import { LoginLegacyOverlay } from '@/components/platform-v7/LoginLegacyOverlay';

export default function LoginTemplate({ children }: { children: ReactNode }) {
  void children;
  return <LoginLegacyOverlay />;
}
