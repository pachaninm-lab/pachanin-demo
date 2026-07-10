#!/usr/bin/env bash
# GrainFlow Vault initialization script (ТЗ 4.4)
# Run once after Vault is unsealed in production

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

echo "=== GrainFlow Vault Setup ==="

# ── Enable secrets engines ──────────────────────────────────────────────────────
vault secrets enable -path=secret kv-v2 2>/dev/null || true
vault secrets enable -path=database database 2>/dev/null || true
vault secrets enable -path=transit transit 2>/dev/null || true
vault secrets enable -path=pki pki 2>/dev/null || true

# ── Configure PostgreSQL dynamic credentials ────────────────────────────────────
vault write database/config/grainflow-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="grainflow-app-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/grainflow?sslmode=require" \
  username="${POSTGRES_ADMIN_USER}" \
  password="${POSTGRES_ADMIN_PASSWORD}"

# Preserve the existing app_readonly membership/inheritance while explicitly
# retaining NOSUPERUSER/NOBYPASSRLS. Rate-limit access is function-only:
# the ephemeral principal cannot read or mutate security.api_rate_limit_buckets.
vault write database/roles/grainflow-app-role \
  db_name=grainflow-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS IN ROLE app_readonly; GRANT USAGE ON SCHEMA public, security TO \"{{name}}\"; GRANT INSERT,UPDATE,SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT,TEXT,INTEGER), security.cleanup_api_rate_limit_buckets(INTEGER) TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL ON FUNCTION security.consume_api_rate_limit(TEXT,TEXT,INTEGER), security.cleanup_api_rate_limit_buckets(INTEGER) FROM \"{{name}}\"; REVOKE ALL ON TABLE security.api_rate_limit_buckets FROM \"{{name}}\"; REVOKE USAGE ON SCHEMA security FROM \"{{name}}\"; REVOKE ALL ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; REVOKE USAGE ON SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# ── Configure Transit engine (ПДн encryption) ────────────────────────────────────
vault write transit/keys/grainflow-pdn type=aes256-gcm96

# ── Apply API service policy ────────────────────────────────────────────────────
vault policy write grainflow-api /vault/policies/policy-grainflow-api.hcl

# ── Enable Kubernetes auth (for k8s service accounts) ──────────────────────────
vault auth enable kubernetes 2>/dev/null || true

vault write auth/kubernetes/config \
  kubernetes_host="https://${KUBERNETES_PORT_443_TCP_ADDR}:443" \
  token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

vault write auth/kubernetes/role/grainflow-api \
  bound_service_account_names=grainflow-api \
  bound_service_account_namespaces=grainflow-prod,grainflow-staging \
  policies=grainflow-api \
  ttl=1h

echo "=== Vault setup complete ==="
