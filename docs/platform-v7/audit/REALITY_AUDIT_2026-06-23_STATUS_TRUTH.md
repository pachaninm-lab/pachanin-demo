# platform-v7 status truth guard — 2026-06-23

## Allowed status language

Use these terms until real runtime readiness exists:

- controlled-pilot;
- pre-integration;
- preview;
- operator-reviewed;
- requires external confirmation;
- audit draft;
- readiness gap;
- not yet live-ready.

## Forbidden unsupported language

Do not claim or imply:

- live deal execution;
- production readiness;
- persistent deal state, unless implemented and verified;
- server-side role enforcement, unless implemented and verified;
- bank confirmation;
- money movement;
- external callback receipt;
- EDO/FGIS/EPD/GPS/elevator/lab integration success;
- load readiness for many concurrent users;
- operational monitoring and rollback coverage.

## Reason

#1982 defines real high-volume readiness as persistence, server-side access, action runtime, evidence workflow, money basis, integrations, load readiness, monitoring and operational controls. Until those layers are built and verified, UI work must not present platform-v7 as live-ready.
