# Exact-main live evidence correction for #2659

Target baseline: `2cf9613f6d89b0d1057b8cdb22df97a816f054e8`.

Confirmed exact-main failures:

- SEO Live Smoke tested production before the matching Netlify deployment was published because its marker was not commit-bound.
- IndexNow submitted before exact deployment/key verification and used a non-canonical key location.
- Security Abuse completed its abuse cases but failed while deriving job metadata from `gh run view --json jobs`.

Correction:

- generate `/.well-known/pc-deploy.json` during the Netlify build with the exact commit SHA;
- wait for that exact SHA before SEO and IndexNow production checks;
- retain machine-readable SEO and IndexNow evidence artifacts;
- generate the IndexNow root key file during the production build rather than storing it in source control;
- derive Security Quality job authority from exact-head GraphQL check runs, preserving all fail-closed abuse/security gates;
- constrain the correction to the source-controlled `fix/exact-main-live-evidence-2659` autopilot branch scope.

Maturity boundary:

- this corrects exact-main evidence orchestration only;
- it does not prove provider-level HA/PITR, target production load, operational soak, external penetration testing or live external integrations;
- issue #2649 remains open;
- `PRODUCTION_OPERATIONALLY_ACCEPTED = NO_GO`.
