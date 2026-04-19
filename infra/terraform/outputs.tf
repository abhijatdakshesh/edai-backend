output "eks_endpoint" {
  value       = aws_eks_cluster.rvtrust.endpoint
  description = "EKS API server endpoint"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS PostgreSQL endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "ElastiCache Redis endpoint"
}

output "recordings_bucket" {
  value       = aws_s3_bucket.recordings.bucket
  description = "S3 bucket name for call recordings"
}
