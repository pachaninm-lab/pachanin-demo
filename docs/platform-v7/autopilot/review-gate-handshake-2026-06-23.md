# review gate handshake

Linked issues: #1978 #1979

Before merge, reviewer must confirm:

- changed files are docs-only or exact role files;
- no forbidden paths changed;
- no unsupported live-readiness claim exists;
- the PR type is explicit;
- runtime/data/access/integration/load/ops work is not hidden inside UI work.

For role-cabinet PRs, also run the #1979 smoke checklist.