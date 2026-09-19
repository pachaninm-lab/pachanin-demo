import { redirect } from 'next/navigation';

export default function DeployCheckCompatibilityPage() {
  redirect('/platform-v7/status');
}
