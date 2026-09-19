# Known limitations

## Runtime
- full live runtime of API/Web was not confirmed inside the current isolated container
- network-disabled environment prevented fresh package installation and live provider callbacks
- local contour was verified through targeted typecheck and repository verification scripts

## External integrations
- EDO / GIS EPD / GosLog / registry live checks are not closed without external access
- bank callbacks and nominal/safe deal rails remain integration-dependent
- accreditation and registry validity checks are code-ready but not live-confirmed

## Scope of current hardening
- 10 problems hardened directly in code
- 4 problems moved to code-plus-live readiness
- source-level embed and repository contour were verified locally before handoff
