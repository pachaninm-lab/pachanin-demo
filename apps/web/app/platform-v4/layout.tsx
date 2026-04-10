import type { ReactNode } from 'react';
import './overrides.css';
import { PlatformV4Enhancer } from './platform-v4-enhancer';

export default function PlatformV4Layout({ children }: { children: ReactNode }) {
  return (
    <div data-platform-v4-refresh="true">
      <PlatformV4Enhancer />
      {children}
    </div>
  );
}
