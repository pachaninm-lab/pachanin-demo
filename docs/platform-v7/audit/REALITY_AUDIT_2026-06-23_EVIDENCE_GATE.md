# platform-v7 evidence gate — 2026-06-23

Evidence and document workflow must be explicit before live-readiness claims.

## Cabinet evidence rule

A cabinet may show evidence status only as:

- uploaded / missing / pending review / rejected / accepted manually;
- external confirmation required;
- audit draft prepared;
- operator review required.

## Forbidden implications

Do not imply:

- EDO document acceptance;
- FGIS/EPD confirmation;
- lab protocol live submission;
- elevator acceptance callback;
- GPS proof ingestion;
- immutable evidence chain;
- production archive.

## Future #1982 document PRs

Split document/evidence work into separate PRs:

1. evidence entity contract;
2. document lifecycle states;
3. review and rejection reasons;
4. audit journal linkage;
5. adapter boundary matrix;
6. retention and export runbook.
