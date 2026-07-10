import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Восстановление доступа — Прозрачная Цена',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
