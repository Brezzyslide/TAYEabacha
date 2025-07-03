# AWS Deployment Guide for NeedsCareAI+ Healthcare Platform

## Overview

This guide provides comprehensive instructions for deploying NeedsCareAI+ to AWS using containerized deployment with ECS Fargate, Application Load Balancer, and RDS PostgreSQL.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Internet      │    │ Application      │    │ ECS Fargate         │
│   Gateway       │───→│ Load Balancer    │───→│ (NeedsCareAI+)     │
│                 │    │ (ALB)            │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                          │
                                                          ▼
                                                ┌─────────────────────┐
                                                │ RDS PostgreSQL      │
                                                │ (Multi-AZ)          │
                                                └─────────────────────┘
```

## Infrastructure Components

### 1. VPC Configuration
- **CIDR Block**: 10.0.0.0/16
- **Public Subnets**: 2 subnets in different AZs (10.0.1.0/24, 10.0.2.0/24)
- **Private Subnets**: 2 subnets for database (10.0.10.0/24, 10.0.11.0/24)
- **Internet Gateway**: For public internet access
- **Security Groups**: Application, ALB, and Database layers

### 2. Database (RDS PostgreSQL)
- **Engine**: PostgreSQL 15.4
- **Instance Class**: db.t3.medium (production-ready)
- **Storage**: 100GB GP3 with auto-scaling to 1TB
- **Multi-AZ**: Enabled for high availability
- **Backup**: 7-day retention, automated snapshots
- **Encryption**: Storage encryption enabled

### 3. Container Platform (ECS Fargate)
- **CPU**: 1024 (1 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Container Insights**: Enabled for monitoring
- **Auto Scaling**: Based on CPU and memory utilization
- **Health Checks**: Application health endpoint monitoring

### 4. Load Balancer (ALB)
- **Type**: Application Load Balancer
- **Health Check**: `/api/health` endpoint
- **Sticky Sessions**: Enabled for session persistence
- **SSL/TLS**: Ready for certificate attachment

## Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

### 2. Docker Setup
```bash
# Install Docker
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 3. Terraform Setup
```bash
# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

## Deployment Steps

### Step 1: Environment Configuration
Create `.env.production` file:
```bash
# Database Configuration
DB_PASSWORD=your_secure_password_here

# Application Configuration
NODE_ENV=production
SESSION_SECRET=your_session_secret_here
OPENAI_API_KEY=your_openai_api_key_here

# AWS Configuration
AWS_REGION=ap-southeast-2
AWS_ACCOUNT_ID=your_account_id_here
```

### Step 2: Infrastructure Deployment
```bash
# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var-file="terraform.tfvars"

# Deploy infrastructure
terraform apply -auto-approve
```

### Step 3: Application Deployment
```bash
# Run the automated deployment script
./deploy-aws.sh
```

### Step 4: Post-Deployment Configuration

#### Update Database URL Secret
```bash
# Get RDS endpoint from Terraform output
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)

# Update the database URL secret
aws secretsmanager update-secret \
    --secret-id "needscareai/database-url" \
    --secret-string "postgresql://needscareai_admin:YOUR_PASSWORD@$RDS_ENDPOINT:5432/needscareai_production"
```

#### Update OpenAI API Key
```bash
aws secretsmanager update-secret \
    --secret-id "needscareai/openai-api-key" \
    --secret-string "YOUR_OPENAI_API_KEY"
```

## Security Configuration

### 1. IAM Roles and Policies

#### ECS Task Execution Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

#### ECS Task Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-southeast-2:*:secret:needscareai/*"
      ]
    }
  ]
}
```

### 2. Security Groups

#### Application Security Group
- **Inbound**: Port 5000 from ALB Security Group only
- **Outbound**: All traffic (for database and external API access)

#### Database Security Group
- **Inbound**: Port 5432 from Application Security Group only
- **Outbound**: None

### 3. Network Security
- Database in private subnets (no internet access)
- Application in private subnets behind ALB
- ALB in public subnets with internet access

## Monitoring and Logging

### 1. CloudWatch Configuration
```bash
# Create log group for ECS
aws logs create-log-group --log-group-name "/ecs/needscareai"

# Set log retention (30 days)
aws logs put-retention-policy \
    --log-group-name "/ecs/needscareai" \
    --retention-in-days 30
```

### 2. Container Insights
- CPU and Memory utilization tracking
- Network I/O monitoring
- Container-level metrics
- Service map visualization

### 3. Application Monitoring
- Health check endpoint: `/api/health`
- Custom metrics via CloudWatch
- Database connection monitoring
- Session management tracking

## Scaling Configuration

### 1. Auto Scaling Policy
```json
{
  "MinCapacity": 2,
  "MaxCapacity": 10,
  "TargetTrackingPolicies": [
    {
      "TargetValue": 70.0,
      "MetricType": "ECSServiceAverageCPUUtilization"
    },
    {
      "TargetValue": 80.0,
      "MetricType": "ECSServiceAverageMemoryUtilization"
    }
  ]
}
```

### 2. Database Scaling
- Storage auto-scaling: 100GB → 1TB
- Read replicas for read-heavy workloads
- Connection pooling optimization

## Backup and Disaster Recovery

### 1. Database Backups
- **Automated**: 7-day retention
- **Manual**: Final snapshot before major updates
- **Point-in-time**: Recovery up to 5 minutes ago

### 2. Application Backups
- **Container Images**: Stored in ECR with lifecycle policies
- **Configuration**: Infrastructure as Code with Terraform
- **Secrets**: AWS Secrets Manager with versioning

## SSL/TLS Configuration

### 1. Certificate Setup
```bash
# Request ACM certificate
aws acm request-certificate \
    --domain-name yourdomain.com \
    --domain-name *.yourdomain.com \
    --validation-method DNS
```

### 2. ALB HTTPS Listener
```bash
# Add HTTPS listener to ALB
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --ssl-policy ELBSecurityPolicy-TLS-1-2-2017-01 \
    --certificates CertificateArn=$CERTIFICATE_ARN
```

## Cost Optimization

### 1. Resource Sizing
- **ECS Tasks**: Start with 1 vCPU, 2GB RAM
- **Database**: db.t3.medium for production
- **Storage**: GP3 for cost-effective performance

### 2. Cost Monitoring
- AWS Cost Explorer integration
- Billing alerts for budget thresholds
- Resource utilization monitoring

## Troubleshooting

### 1. Common Issues

#### Container Startup Failures
```bash
# Check ECS service events
aws ecs describe-services --cluster needscareai-cluster --services needscareai-service

# Check CloudWatch logs
aws logs get-log-events --log-group-name "/ecs/needscareai" --log-stream-name "ecs/needscareai-app/TASK_ID"
```

#### Database Connection Issues
```bash
# Test database connectivity
aws rds describe-db-instances --db-instance-identifier needscareai-db

# Check security group rules
aws ec2 describe-security-groups --group-ids $DB_SECURITY_GROUP_ID
```

#### Health Check Failures
```bash
# Manual health check test
curl -f http://LOAD_BALANCER_DNS/api/health

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN
```

### 2. Performance Tuning

#### Database Optimization
- Connection pooling configuration
- Query performance monitoring
- Index optimization

#### Application Optimization
- Node.js memory settings
- Session store optimization
- Cache implementation

## Maintenance Procedures

### 1. Application Updates
```bash
# Build and push new image
docker build -t needscareai:v2.0.0 .
docker tag needscareai:v2.0.0 $ECR_URI:v2.0.0
docker push $ECR_URI:v2.0.0

# Update ECS service
aws ecs update-service \
    --cluster needscareai-cluster \
    --service needscareai-service \
    --task-definition needscareai-task:v2.0.0
```

### 2. Database Maintenance
```bash
# Create manual snapshot before updates
aws rds create-db-snapshot \
    --db-instance-identifier needscareai-db \
    --db-snapshot-identifier needscareai-pre-update-$(date +%Y%m%d)
```

## Support and Resources

### 1. AWS Documentation
- [ECS Developer Guide](https://docs.aws.amazon.com/ecs/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)
- [ALB User Guide](https://docs.aws.amazon.com/elasticloadbalancing/)

### 2. Application Resources
- Health Check: `http://your-domain.com/api/health`
- CloudWatch Dashboard: Custom metrics and logs
- ECS Console: Service monitoring and scaling

### 3. Emergency Contacts
- AWS Support: Enterprise support plan recommended
- Application Team: Internal escalation procedures
- Database Administrator: For performance tuning

---

**Note**: This deployment is configured for Australian healthcare compliance with data residency in ap-southeast-2 (Sydney) region. Ensure all regulatory requirements are met before production deployment.