import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Новый пароль — Прозрачная Цена',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
