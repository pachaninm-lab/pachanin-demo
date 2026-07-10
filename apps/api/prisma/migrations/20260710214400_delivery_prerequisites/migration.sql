-- Cryptographic primitives used for non-secret claim tokens and evidence hashes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS delivery;
REVOKE ALL ON SCHEMA delivery FROM PUBLIC;
