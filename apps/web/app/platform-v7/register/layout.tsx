import type { ReactNode } from 'react';
import { RegisterCleanClient } from './RegisterCleanClient';

export default function Layout(_: { children: ReactNode }) {
  return <RegisterCleanClient selectedRole='seller' />;
}
