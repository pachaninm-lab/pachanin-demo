import type { Prisma } from '@prisma/client';

/**
 * Whether an instant falls inside a closed accounting period.
 *
 * One question, asked the same way by everything that writes an accounting fact.
 * It was a private helper in two repositories first, which is one copy away from
 * two answers: a slice that read `periodEnd >= at` instead of `>` would accept a
 * fact on the boundary the others refuse, and the disagreement would only show
 * up as a figure that moved after a month was reported closed.
 *
 * Inclusive start, exclusive end — the convention the periods table, the rule
 * registry and the tax profiles all carry.
 *
 * Read inside the caller's transaction, under the caller's row policies, so the
 * answer is the one the guard in the database will reach a moment later.
 */
export async function monthIsClosed(
  tx: Prisma.TransactionClient,
  organizationId: string,
  at: Date,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ closed: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM public."accounting_periods"
       WHERE "organizationId" = ${organizationId}
         AND "status" = 'CLOSED'
         AND "periodStart" <= ${at}
         AND "periodEnd" > ${at}
    ) AS closed
  `;
  return rows[0]?.closed === true;
}
