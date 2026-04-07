import { redirect } from 'next/navigation';

// Root always goes to /demo — demo-first platform
export default function HomePage() {
  redirect('/demo');
}
