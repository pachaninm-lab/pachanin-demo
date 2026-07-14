import { redirect } from 'next/navigation';

export default function ReadinessGrainAliasPage() {
  redirect('/platform-v7/status');
}
