# Exact-main live evidence correction for #2659

Target baseline: `0a45a565f134921cd8bbe3361863e62660b128df`.

Confirmed exact-main failures:

- SEO Live Smoke tested production before the matching Netlify deployment was published because its marker was not commit-bound.
- IndexNow submitted before exact deployment/key verification and used a non-canonical key location.
- Security Abuse completed its abuse cases but failed while deriving job metadata from `gh run view --json jobs`.

Correction:

- generate `/.well-known/pc-deploy.json` during the Netlify build with the exact commit SHA;
- wait for that exact SHA before SEO and IndexNow production checks;
- retain machine-readable SEO and IndexNow evidence artifacts;
- host the IndexNow key at the protocol root path `/{key}.txt` and verify it before submission;
- derive Security Quality job authority from exact-head GraphQL check runs, preserving all fail-closed abuse/security gates.

Maturity boundary:

- this corrects exact-main evidence orchestration only;
- it does not prove provider-level HA/PITR, target production load, operational soak, external penetration testing or live external integrations;
- issue #2649 remains open;
- `PRODUCTION_OPERATIONALLY_ACCEPTED = NO_GO`.
