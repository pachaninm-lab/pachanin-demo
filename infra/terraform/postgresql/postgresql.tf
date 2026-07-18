locals {
  cluster_name = "grainflow-postgresql"
  database     = "grainflow"
  ddl_user     = "grainflow_ddl" # migration Job principal (owns the schema)
  app_user     = "grainflow_app" # runtime principal used by the API via PgBouncer
}

# Firewall: only the k8s subnets running PgBouncer may reach PostgreSQL. Nothing
# is publicly exposed.
resource "yandex_vpc_security_group" "postgresql" {
  name       = "${local.cluster_name}-sg"
  network_id = var.network_id

  ingress {
    description    = "PostgreSQL from in-cluster PgBouncer"
    protocol       = "TCP"
    port           = 6432
    v4_cidr_blocks = var.allowed_cidrs
  }

  ingress {
    description    = "PostgreSQL direct (migrations Job)"
    protocol       = "TCP"
    port           = 5432
    v4_cidr_blocks = var.allowed_cidrs
  }

  egress {
    description    = "Allow all egress"
    protocol       = "ANY"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "yandex_mdb_postgresql_cluster" "grainflow" {
  name                = local.cluster_name
  environment         = "PRODUCTION"
  network_id          = var.network_id
  security_group_ids  = [yandex_vpc_security_group.postgresql.id]
  deletion_protection = var.deletion_protection

  config {
    version = var.pg_version

    resources {
      resource_preset_id = var.pg_resource_preset_id
      disk_type_id       = var.pg_disk_type_id
      disk_size          = var.pg_disk_size_gb
    }

    # Automatic failover to a synchronous replica keeps the write primary highly
    # available; the money path never depends on a single host.
    autofailover = true

    postgresql_config = {
      max_connections = var.pg_max_connections
      # RLS relies on SET LOCAL GUCs; leave default_transaction settings alone.
      log_min_duration_statement          = 500
      idle_in_transaction_session_timeout = 60000
    }

    backup_window_start {
      hours   = 2
      minutes = 0
    }
    backup_retain_period_days = var.backup_retain_period_days

    access {
      data_lens  = false
      web_sql    = false
      serverless = false
    }

    performance_diagnostics {
      enabled                      = true
      sessions_sampling_interval   = 60
      statements_sampling_interval = 600
    }

    # Built-in Odyssey pooler in transaction mode as defense-in-depth alongside
    # the in-cluster PgBouncer. Both are transaction-pooling; RLS SET LOCAL is
    # verified safe under transaction pooling.
    pooler_config {
      pool_discard = true
      pooling_mode = "TRANSACTION"
    }
  }

  dynamic "host" {
    for_each = var.hosts
    content {
      zone             = host.value.zone
      subnet_id        = host.value.subnet_id
      assign_public_ip = false
    }
  }

  maintenance_window {
    type = "WEEKLY"
    day  = "SAT"
    hour = 3
  }

  lifecycle {
    # Passwords are managed on the user resources; ignore drift on host order.
    ignore_changes = [host]
  }
}

# DDL principal — owns the database, used only by the pre-upgrade migration Job.
resource "yandex_mdb_postgresql_user" "ddl" {
  cluster_id = yandex_mdb_postgresql_cluster.grainflow.id
  name       = local.ddl_user
  password   = var.ddl_password
  conn_limit = 20
}

# Runtime principal — least privilege, used by the API through PgBouncer.
resource "yandex_mdb_postgresql_user" "app" {
  cluster_id = yandex_mdb_postgresql_cluster.grainflow.id
  name       = local.app_user
  password   = var.app_password
  conn_limit = var.pg_max_connections
}

resource "yandex_mdb_postgresql_database" "grainflow" {
  cluster_id = yandex_mdb_postgresql_cluster.grainflow.id
  name       = local.database
  owner      = yandex_mdb_postgresql_user.ddl.name

  extension {
    name = "uuid-ossp"
  }
  extension {
    name = "pgcrypto"
  }

  depends_on = [
    yandex_mdb_postgresql_user.ddl,
    yandex_mdb_postgresql_user.app,
  ]
}
