import { redirect } from 'next/navigation';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

// Phase 2 / PR-3 — dual bank entry resolved. The canonical bank cabinet is
// /platform-v7/bank ("Кабинет банка"). /platform-v7/bank/clean is kept only as a
// legacy "clean room" alias that redirects to canonical — not a second bank
// cabinet version. No bank cockpit content or money logic lives here anymore.
export default function BankCleanAliasRedirect() {
  redirect(PLATFORM_V7_BANK_ROUTE);
}
