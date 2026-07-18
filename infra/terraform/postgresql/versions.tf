terraform {
  required_version = ">= 1.5.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.100.0"
    }
  }

  # Remote state in Yandex Object Storage (S3-compatible). Create the bucket and
  # a service-account static key once, then uncomment. Until then Terraform uses
  # local state — never commit terraform.tfstate (it holds secrets).
  #
  # backend "s3" {
  #   endpoints   = { s3 = "https://storage.yandexcloud.net" }
  #   bucket      = "grainflow-tfstate"
  #   key         = "postgresql/terraform.tfstate"
  #   region      = "ru-central1"
  #   # YC quirks: the S3 backend needs these checks skipped.
  #   skip_region_validation      = true
  #   skip_credentials_validation = true
  #   skip_requesting_account_id  = true
  #   skip_s3_checksum            = true
  # }
}
