# Next AP-14D exact-main live run

After this diagnostic slice reaches `main`, run the permanent read-only workflow on exact `main` and compare each failed source against the AP-14D remediation baseline.

Acceptance for the diagnostic rerun:

1. no failed source may emit the legacy generic `source_transport_failure` code;
2. each failed source must emit one registered bounded diagnostic code or an existing policy/parser code;
3. the workflow keeps `contents: read` only;
4. collection and topic coverage remain independent statuses;
5. the artifact contains immutable refresh history, the deterministic health dashboard, active alerts, remediation trace, knowledge decision and a complete file index;
6. no source is marked covered without a fresh successful observation;
7. controlled `workflow_dispatch` acceptance requires `6/6` observed sources, `8/8` covered topics, `10000/10000` critical coverage, no history gap and `HEALTHY` dashboard status;
8. scheduled refresh fails after artifact upload on critical, stale, expired or history-gap alerts.

This rerun identifies the next source-specific repair. It is not production attestation.
