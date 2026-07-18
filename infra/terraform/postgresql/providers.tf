provider "yandex" {
  # Authenticate out-of-band, never in code:
  #   export YC_TOKEN="$(yc iam create-token)"        # or a service-account key:
  #   export YC_SERVICE_ACCOUNT_KEY_FILE=./sa-key.json
  cloud_id  = var.yc_cloud_id
  folder_id = var.yc_folder_id
  zone      = var.yc_default_zone
}
