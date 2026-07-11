import '@/styles/platform-v7-staff.css';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <div className='pc-staff-root'>{children}</div>;
}
