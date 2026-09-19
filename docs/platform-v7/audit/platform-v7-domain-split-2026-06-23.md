# platform-v7 domain split rule — 2026-06-23

Real-operation readiness work from #1982 must be split by domain:

- data
- runtime
- access
- money
- documents
- integrations
- load
- ops
- QA

Do not mix these into UI PRs. UI PRs may reference missing runtime layers, but must not silently add backend, DB, auth, session, API, package or lockfile changes.
