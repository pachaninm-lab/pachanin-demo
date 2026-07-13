# Self-modifying workflow prohibition

Repository automation must not create, rewrite or push source-of-truth state directly to `main`.

Required path:

1. branch from the current `main`;
2. explicit diff;
3. pull request;
4. exact-head CI;
5. review;
6. merge with expected head SHA.

Temporary workflows that modify repository state and push to `main` are prohibited because they bypass review, branch protection evidence and deterministic ownership of the change.
