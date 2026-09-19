# Exact-main live evidence correction for #2659

Target baseline: `452da9fdeca729d91a2bef9b9b2b4891bd515c73`.

Confirmed exact-main failures:

- SEO Live Smoke originally tested production before the matching Netlify deployment was published because its marker was not commit-bound.
- The first commit-bound marker used `/.well-known/pc-deploy.json`, but the production middleware treated that unregistered path as protected and returned the public entry HTML instead of JSON.
- The same middleware boundary prevented a root `/{key}.txt` IndexNow ownership file from being served as plain text.
- Security Abuse previously completed its abuse cases but failed while deriving job metadata from `gh run view --json jobs`.

Correction:

- generate `/manifest-pc-deploy.json` during the Netlify build with the exact commit SHA; the existing `/manifest` public prefix makes this endpoint reachable without widening middleware or RBAC;
- generate `/manifest-indexnow-{key}.txt` during the production build and pass that same-host URL explicitly as `keyLocation`;
- wait for the exact deployed SHA before SEO and IndexNow production checks;
- retain exact-SHA machine-readable SEO and IndexNow evidence artifacts;
- derive Security Quality job authority from exact-head GraphQL check runs, preserving all fail-closed abuse/security gates;
- constrain the correction to the source-controlled `fix/exact-main-live-evidence-2659` autopilot branch scope.

Maturity boundary:

- this corrects exact-main evidence orchestration only;
- it does not prove provider-level HA/PITR, target production load, operational soak, external penetration testing or live external integrations;
- issue #2649 remains open;
- `PRODUCTION_OPERATIONALLY_ACCEPTED = NO_GO`.
