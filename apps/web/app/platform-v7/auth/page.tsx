import { redirect } from 'next/navigation';

export default function AuthCompatibilityPage() {
  redirect('/platform-v7/login');
}
