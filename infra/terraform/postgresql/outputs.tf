output "cluster_id" {
  description = "Managed PostgreSQL cluster id."
  value       = yandex_mdb_postgresql_cluster.grainflow.id
}

# Special cluster FQDNs: `.rw` always resolves to the current master (writes),
# `.ro` load-balances across replicas (reads). Point PgBouncer at the master
# FQDN; send read-only reporting traffic to the replica FQDN.
output "master_fqdn" {
  description = "Read/write FQDN — always the current master. Use for PgBouncer upstream."
  value       = "c-${yandex_mdb_postgresql_cluster.grainflow.id}.rw.mdb.yandexcloud.net"
}

output "replica_fqdn" {
  description = "Read-only FQDN — load-balanced across replicas. Use for read replicas / reporting."
  value       = "c-${yandex_mdb_postgresql_cluster.grainflow.id}.ro.mdb.yandexcloud.net"
}

output "database" {
  description = "Application database name."
  value       = yandex_mdb_postgresql_database.grainflow.name
}

output "app_user" {
  description = "Least-privilege runtime user (API via PgBouncer)."
  value       = yandex_mdb_postgresql_user.app.name
}

output "ddl_user" {
  description = "DDL/migration user (migration Job only)."
  value       = yandex_mdb_postgresql_user.ddl.name
}

# Ready-to-use connection URL for the API, with passwords redacted. The real
# secret (grainflow-api-secrets DATABASE_URL) points at PgBouncer, not directly
# at this FQDN; see infra/helm/grainflow/values-production.yaml.
output "app_database_url_template" {
  description = "DATABASE_URL template (fill the password from the secret)."
  value       = "postgresql://${yandex_mdb_postgresql_user.app.name}:<APP_PASSWORD>@c-${yandex_mdb_postgresql_cluster.grainflow.id}.rw.mdb.yandexcloud.net:6432/${yandex_mdb_postgresql_database.grainflow.name}?sslmode=verify-full&pgbouncer=true&connection_limit=10&pool_timeout=10"
}
