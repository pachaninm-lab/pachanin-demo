# HashiCorp Vault Policy — grainflow-api service (ТЗ 4.4)
# Apply: vault policy write grainflow-api vault/policy-grainflow-api.hcl

# ── Dynamic PostgreSQL credentials ──────────────────────────────────────────────
path "database/creds/grainflow-app-role" {
  capabilities = ["read"]
}

# ── Integration API keys (read-only) ────────────────────────────────────────────
path "secret/data/grainflow/integrations/+/credentials" {
  capabilities = ["read"]
}

# ── JWT secrets ─────────────────────────────────────────────────────────────────
path "secret/data/grainflow/auth/jwt" {
  capabilities = ["read"]
}

# ── MFA / TOTP secrets ──────────────────────────────────────────────────────────
path "secret/data/grainflow/auth/mfa" {
  capabilities = ["read"]
}

# ── Webhook signing secrets ──────────────────────────────────────────────────────
path "secret/data/grainflow/webhooks/+/secret" {
  capabilities = ["read"]
}

# ── Transit (column-level encryption для ПДн) ───────────────────────────────────
path "transit/encrypt/grainflow-pdn" {
  capabilities = ["update"]
}

path "transit/decrypt/grainflow-pdn" {
  capabilities = ["update"]
}

# ── S3 / Object storage credentials ─────────────────────────────────────────────
path "secret/data/grainflow/storage/s3" {
  capabilities = ["read"]
}

# ── Redis credentials ────────────────────────────────────────────────────────────
path "secret/data/grainflow/cache/redis" {
  capabilities = ["read"]
}

# ── Kafka credentials ────────────────────────────────────────────────────────────
path "secret/data/grainflow/kafka/credentials" {
  capabilities = ["read"]
}

# ── Token renewal ────────────────────────────────────────────────────────────────
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "sys/leases/renew" {
  capabilities = ["update"]
}
