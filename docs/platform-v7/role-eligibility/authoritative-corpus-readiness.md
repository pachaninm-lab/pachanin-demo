# Role Eligibility authoritative corpus readiness

Refs #4922.

The production shadow corpus contains durable historical checks that are not all suitable as legal-entity authority candidates. A current check whose INN fails the official checksum cannot be matched to an official legal-entity authority and therefore must not increase the authoritative evidence readiness denominator.

This is a read-only classification rule only:

- invalid-checksum rows remain durable history;
- no row is deleted, updated, backfilled or reclassified in PostgreSQL;
- exclusion from the readiness denominator is not negative legal-entity evidence;
- FNS RSMP absence remains supplementary positive-only and is never converted into a negative assertion;
- registration behavior is unchanged;
- Role Eligibility enforcement remains false.

Terminal readiness still requires real authoritative source evidence for each enforceable path that has a proven machine-readable authority contract. Filtering invalid identifiers cannot by itself produce readiness PASS.
