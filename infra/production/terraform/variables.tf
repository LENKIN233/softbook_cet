variable "environment" {
  description = "Isolated Softbook environment name."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "region" {
  description = "Tencent Cloud region."
  type        = string
  default     = "ap-shanghai"
}

variable "availability_zone" {
  description = "Availability zone shared by the database and CloudBase Run subnet."
  type        = string
}

variable "vpc_id" {
  description = "Existing CloudBase Run VPC ID."
  type        = string
}

variable "subnet_id" {
  description = "Existing CloudBase Run subnet ID."
  type        = string
}

variable "subnet_cidr" {
  description = "CIDR of the CloudBase Run subnet allowed to reach PostgreSQL."
  type        = string

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "subnet_cidr must be a valid IPv4 or IPv6 CIDR."
  }
}

variable "postgresql_root_password" {
  description = "Initial PostgreSQL root password. Supply through TF_VAR_postgresql_root_password."
  type        = string
  sensitive   = true
}

variable "postgresql_cpu" {
  description = "PostgreSQL CPU cores. Must match an available TencentDB specification."
  type        = number
  default     = 2
}

variable "postgresql_memory_gb" {
  description = "PostgreSQL memory in GiB."
  type        = number
  default     = 4
}

variable "postgresql_storage_gb" {
  description = "PostgreSQL storage in GiB, in multiples of 10."
  type        = number
  default     = 100

  validation {
    condition     = var.postgresql_storage_gb >= 50 && var.postgresql_storage_gb % 10 == 0
    error_message = "postgresql_storage_gb must be at least 50 and a multiple of 10."
  }
}

variable "tags" {
  description = "Additional resource tags."
  type        = map(string)
  default     = {}
}
