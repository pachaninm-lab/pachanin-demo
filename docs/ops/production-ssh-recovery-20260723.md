# Production SSH transport recovery — 2026-07-23

The exact-SHA web release stopped before network authentication because the primary protected key slot contained public-key material rather than a private key. The canonical image was accepted; the REG.RU VPS was not mutated.

The recovery contour validates every protected private-key slot independently and supports raw, literal-newline and base64 private-key encodings. Public keys and encrypted or malformed private keys fail closed. If no private key is valid, the workflow may use an already protected repository password credential solely against the canonical host and canonical root principal, with strict host-key checking, exact-SHA image authority, web-only mutation, live acceptance and automatic rollback.

No credential content, server path, environment value or raw authentication error is written to Git or release evidence.
