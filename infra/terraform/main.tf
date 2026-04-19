terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# EKS Cluster
resource "aws_eks_cluster" "rvtrust" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_role.arn

  vpc_config {
    subnet_ids = var.subnet_ids
  }

  tags = {
    Environment = var.environment
    Project     = "rvtrust"
  }
}

resource "aws_iam_role" "eks_role" {
  name = "${var.cluster_name}-eks-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_role.name
}

# RDS PostgreSQL 16
resource "aws_db_instance" "postgres" {
  identifier           = "${var.cluster_name}-postgres"
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = "db.t3.xlarge"
  allocated_storage    = 100
  db_name              = "rvtrust"
  username             = "rvtrust"
  password             = var.db_password
  publicly_accessible  = false
  deletion_protection  = true

  tags = {
    Environment = var.environment
  }
}

# ElastiCache Redis 7
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.cluster_name}-redis"
  engine               = "redis"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
}

# S3 bucket for recordings/files
resource "aws_s3_bucket" "recordings" {
  bucket = "rvtrust-recordings-${var.environment}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}
