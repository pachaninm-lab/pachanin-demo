import { redirect } from 'next/navigation';

export default function RuntimeStatusCompatibilityPage() {
  redirect('/platform-v7/status');
}
