variable "environment" {
  type        = string
  description = "Deployment environment: staging or prod"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-south-1"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
  default     = "rvtrust-eks"
}

variable "subnet_ids" {
  type        = list(string)
  description = "VPC subnet IDs for EKS"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password"
}
