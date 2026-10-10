# Gekta bounded model candidate grant, 2026-10-08

The owner renewed the instruction to finish Gekta on 2026-10-08. This proposal
requires a separate, five-document CORE admission and independently reviewed
source acceptance before any runtime command. It is not runtime authorization
merely because this file exists in a private proposal or a pull request.

Grant identity: `gekta-finish-20261008-4b-oneuse`. The former
`gekta-critical-5974230017` is retired and remains spent. Its marker files must
not be removed, reset, edited, refunded or treated as a successful test receipt.

The new grant permits one critical corpus and, only after the operator has
inspected actual critical PASS, cleanup PASS and unchanged healthy baseline,
one extra corpus. Each retains the existing 420-second hard lease, non-root
SSH principal, pinned host key, loopback-only port, exclusive durable claim
and exec markers, resource guards, pidfd watchdog and verified cleanup. A
failure, cancellation, transport loss or changed source does not replenish a
slot. There is no recurring task, automatic retry or standing runtime budget.

After admission and source acceptance, commands on the existing owner journal
#3896 must be exact sole-body commands and name the current full main SHA:

```
/gekta qwen35-4b critical FULL_40_HEX_MAIN_SHA gekta-finish-20261008-4b-oneuse
/gekta qwen35-4b extra FULL_40_HEX_MAIN_SHA gekta-finish-20261008-4b-oneuse
```

Old command syntax and the retired grant cannot consume these new slots. The
helper binds both admission and checkout to the exact current main. Critical
and extra evidence must bind the same source SHA; the operator must preserve
both real workflow receipts rather than call either selected corpus a complete
candidate acceptance. Marker existence proves consumption only.

The candidate remains the immutable Qwen3.5-4B Q4_K_M artifact already pinned
by the helper. The 8B baseline stays in service; candidate HTTP stays private.
No routing update, new role, service-control permission, sudo, polkit bypass,
production secret change or permanent activation is authorized by this grant.
A candidate test PASS alone cannot establish permanent model replacement.
