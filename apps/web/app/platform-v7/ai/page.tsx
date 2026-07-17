import { redirect } from 'next/navigation';

/**
 * Compatibility alias for the canonical conversational assistant workspace.
 * Keeping one route avoids fragmented histories and conflicting assistant UX.
 */
export default function PlatformV7AiPage() {
  redirect('/platform-v7/assistant');
}
