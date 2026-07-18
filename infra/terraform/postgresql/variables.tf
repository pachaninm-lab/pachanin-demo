variable "yc_cloud_id" {
  description = "Yandex Cloud cloud id."
  type        = string
}

variable "yc_folder_id" {
  description = "Yandex Cloud folder id that will own the PostgreSQL cluster."
  type        = string
}

variable "yc_default_zone" {
  description = "Default availability zone for provider operations."
  type        = string
  default     = "ru-central1-a"
}

variable "network_id" {
  description = "Id of the existing VPC network the Kubernetes cluster runs in."
  type        = string
}

variable "hosts" {
  description = <<-EOT
    PostgreSQL hosts, one per availability zone. Three hosts across three zones
    give synchronous HA with automatic failover. Each entry pins the host to a
    zone and the subnet in that zone.
  EOT
  type = list(object({
    zone      = string
    subnet_id = string
  }))
  validation {
    condition     = length(var.hosts) >= 3
    error_message = "Provide at least 3 hosts across distinct zones for a highly available federal cluster."
  }
}

variable "allowed_cidrs" {
  description = "CIDR ranges permitted to reach the cluster (the k8s pod/node subnets running PgBouncer)."
  type        = list(string)
}

variable "pg_version" {
  description = "PostgreSQL major version. Matches the application's local and CI PostgreSQL."
  type        = string
  default     = "16"
}

variable "pg_resource_preset_id" {
  description = "Compute preset per host (vCPU/RAM). s3-c8-m32 = 8 vCPU / 32 GB. Size from load tests + headroom."
  type        = string
  default     = "s3-c8-m32"
}

variable "pg_disk_size_gb" {
  description = "Storage per host in GB."
  type        = number
  default     = 256
}

variable "pg_disk_type_id" {
  description = "Disk type. network-ssd is replicated SSD; use network-ssd-io-m1 for higher IOPS."
  type        = string
  default     = "network-ssd"
}

variable "pg_max_connections" {
  description = <<-EOT
    Server-side max_connections. PgBouncer multiplexes the API tier onto a small
    number of server connections, so this stays modest even at 20 API replicas.
  EOT
  type        = number
  default     = 400
}

variable "backup_retain_period_days" {
  description = "Backup retention in days (point-in-time recovery window)."
  type        = number
  default     = 14
}

variable "ddl_password" {
  description = "Password for the migration/DDL principal. Supply via TF_VAR_ddl_password, never in code."
  type        = string
  sensitive   = true
}

variable "app_password" {
  description = "Password for the least-privilege runtime principal. Supply via TF_VAR_app_password."
  type        = string
  sensitive   = true
}

variable "deletion_protection" {
  description = "Block accidental destruction of the production cluster."
  type        = bool
  default     = true
}
