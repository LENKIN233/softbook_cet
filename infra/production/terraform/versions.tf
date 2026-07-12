terraform {
  required_version = ">= 1.9.0"

  required_providers {
    tencentcloud = {
      source  = "tencentcloudstack/tencentcloud"
      version = "~> 1.83"
    }
  }
}

provider "tencentcloud" {
  region = var.region
}
