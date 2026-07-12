output "content_bucket" {
  description = "Private COS bucket used for immutable card packs and audio assets."
  value       = tencentcloud_cos_bucket.content.bucket
}

output "postgresql_instance_id" {
  description = "TencentDB PostgreSQL instance ID."
  value       = tencentcloud_postgresql_instance.api.id
}

output "postgresql_private_endpoint" {
  description = "Private PostgreSQL endpoint for CloudBase Run."
  value = {
    host = tencentcloud_postgresql_instance.api.private_access_ip
    port = tencentcloud_postgresql_instance.api.private_access_port
  }
}
