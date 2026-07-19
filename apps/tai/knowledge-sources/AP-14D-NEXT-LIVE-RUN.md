# Next AP-14D exact-main live run

After this diagnostic slice reaches `main`, run the permanent read-only workflow on exact `main` and compare each failed source against the AP-14D remediation baseline.

Acceptance for the diagnostic rerun:

1. no failed source may emit the legacy generic `source_transport_failure` code;
2. each failed source must emit one registered bounded diagnostic code or an existing policy/parser code;
3. the workflow keeps `contents: read` only;
4. collection and topic coverage remain independent statuses;
5. a lower or equal coverage result is accepted as evidence when source health is unchanged or worse;
6. no source is marked covered without a fresh successful observation.

This rerun identifies the next source-specific repair. It is not production attestation.
