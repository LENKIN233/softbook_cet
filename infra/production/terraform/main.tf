data "tencentcloud_user_info" "current" {}

locals {
  common_tags = merge(
    {
      application = "softbook-cet"
      environment = var.environment
      managed_by  = "terraform"
    },
    var.tags,
  )
}

resource "tencentcloud_security_group" "api_database" {
  name        = "softbook-${var.environment}-api-database"
  description = "Restrict Softbook PostgreSQL access to the CloudBase Run subnet."
  tags        = local.common_tags
}

resource "tencentcloud_security_group_rule" "api_database_from_runtime" {
  security_group_id = tencentcloud_security_group.api_database.id
  type              = "ingress"
  cidr_ip           = var.subnet_cidr
  ip_protocol       = "tcp"
  port_range        = "5432"
  policy            = "accept"
}

resource "tencentcloud_postgresql_instance" "api" {
  name                 = "softbook-${var.environment}-api"
  availability_zone    = var.availability_zone
  charge_type          = "POSTPAID_BY_HOUR"
  vpc_id               = var.vpc_id
  subnet_id            = var.subnet_id
  db_major_version     = "16"
  root_user            = "softbook_root"
  root_password        = var.postgresql_root_password
  charset              = "UTF8"
  cpu                  = var.postgresql_cpu
  memory               = var.postgresql_memory_gb
  storage              = var.postgresql_storage_gb
  storage_type         = "CLOUD_SSD"
  public_access_switch = false
  delete_protection    = true
  need_support_tde     = 1
  security_groups      = [tencentcloud_security_group.api_database.id]
  tags                 = local.common_tags

  timeouts {
    create = "60m"
    update = "60m"
  }
}

resource "tencentcloud_postgresql_backup_plan" "api" {
  db_instance_id               = tencentcloud_postgresql_instance.api.id
  plan_name                    = "softbook-${var.environment}-monthly-base"
  backup_period_type           = "month"
  backup_period                = ["1", "8", "15", "22"]
  min_backup_start_time        = "01:00:00"
  max_backup_start_time        = "03:00:00"
  base_backup_retention_period = 35
  log_backup_retention_period  = 14
  backup_method                = "physical"
}

resource "tencentcloud_cos_bucket" "content" {
  bucket               = "softbook-${var.environment}-content-${data.tencentcloud_user_info.current.app_id}"
  acl                  = "private"
  encryption_algorithm = "AES256"
  versioning_enable    = true

  tags = local.common_tags
}
