import { redirect } from 'next/navigation';

/**
 * Historical compatibility entry.
 *
 * The operator has one canonical Design System v8 workspace at /operator.
 * Keeping a second cockpit here would split navigation, visual contracts and
 * task priority. Server redirect preserves existing bookmarks without mounting
 * the legacy control-tower runtime or duplicating business state.
 */
export default function PlatformV7ControlTowerPage() {
  redirect('/platform-v7/operator');
}
