#!/bin/bash
# AWS Deployment Script for NeedsCareAI+ Healthcare Platform
# Deploys to AWS ECS with Fargate using Terraform

set -e

echo "🚀 Starting AWS deployment for NeedsCareAI+ Healthcare Platform"

# Configuration
AWS_REGION="ap-southeast-2"
ECR_REPO_NAME="needscareai"
APP_NAME="needscareai"
ENVIRONMENT="production"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Failed to get AWS Account ID. Please check AWS credentials."
    exit 1
fi

echo "📋 AWS Account ID: $AWS_ACCOUNT_ID"
echo "📋 Region: $AWS_REGION"

# Step 1: Build and push Docker image to ECR
echo "🐳 Building and pushing Docker image..."

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION > /dev/null 2>&1 || {
    echo "📦 Creating ECR repository..."
    aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION
}

# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t $ECR_REPO_NAME:latest .

# Tag and push image
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest"
docker tag $ECR_REPO_NAME:latest $ECR_URI
docker push $ECR_URI

echo "✅ Docker image pushed to ECR: $ECR_URI"

# Step 2: Create secrets in AWS Secrets Manager
echo "🔐 Setting up AWS Secrets Manager..."

# Database URL secret
aws secretsmanager describe-secret --secret-id "$APP_NAME/database-url" --region $AWS_REGION > /dev/null 2>&1 || {
    echo "Creating database URL secret..."
    aws secretsmanager create-secret \
        --name "$APP_NAME/database-url" \
        --description "Database URL for NeedsCareAI+ application" \
        --region $AWS_REGION
}

# Session secret
aws secretsmanager describe-secret --secret-id "$APP_NAME/session-secret" --region $AWS_REGION > /dev/null 2>&1 || {
    echo "Creating session secret..."
    aws secretsmanager create-secret \
        --name "$APP_NAME/session-secret" \
        --description "Session secret for NeedsCareAI+ application" \
        --secret-string "$(openssl rand -base64 32)" \
        --region $AWS_REGION
}

# OpenAI API key secret
aws secretsmanager describe-secret --secret-id "$APP_NAME/openai-api-key" --region $AWS_REGION > /dev/null 2>&1 || {
    echo "Creating OpenAI API key secret..."
    aws secretsmanager create-secret \
        --name "$APP_NAME/openai-api-key" \
        --description "OpenAI API key for NeedsCareAI+ application" \
        --region $AWS_REGION
    echo "⚠️  Please update the OpenAI API key in AWS Secrets Manager"
}

# Step 3: Deploy infrastructure with Terraform
echo "🏗️  Deploying infrastructure with Terraform..."

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="aws_region=$AWS_REGION" -var="db_password=$(openssl rand -base64 16)"

# Apply infrastructure
terraform apply -auto-approve -var="aws_region=$AWS_REGION" -var="db_password=$(openssl rand -base64 16)"

# Get RDS endpoint from Terraform output
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
DB_URL="postgresql://needscareai_admin:$(terraform output -raw db_password)@$RDS_ENDPOINT:5432/needscareai_production"

# Update database URL secret
aws secretsmanager update-secret \
    --secret-id "$APP_NAME/database-url" \
    --secret-string "$DB_URL" \
    --region $AWS_REGION

echo "✅ Infrastructure deployed successfully"

# Step 4: Deploy ECS Service
echo "🚀 Deploying ECS Service..."

# Update task definition with correct image URI
sed "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" aws-ecs-task-definition.json > task-definition-updated.json

# Register task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://task-definition-updated.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "📋 Task Definition ARN: $TASK_DEFINITION_ARN"

# Create or update ECS service
aws ecs describe-services --cluster "$APP_NAME-cluster" --services "$APP_NAME-service" --region $AWS_REGION > /dev/null 2>&1 && {
    echo "📋 Updating existing ECS service..."
    aws ecs update-service \
        --cluster "$APP_NAME-cluster" \
        --service "$APP_NAME-service" \
        --task-definition "$TASK_DEFINITION_ARN" \
        --region $AWS_REGION
} || {
    echo "📋 Creating new ECS service..."
    aws ecs create-service \
        --cluster "$APP_NAME-cluster" \
        --service-name "$APP_NAME-service" \
        --task-definition "$TASK_DEFINITION_ARN" \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -json | jq -r '.public_subnet_ids.value | join(",")')]},securityGroups=[$(terraform output -raw ecs_security_group_id)],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$(terraform output -raw target_group_arn),containerName=needscareai-app,containerPort=5000" \
        --region $AWS_REGION
}

# Step 5: Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable --cluster "$APP_NAME-cluster" --services "$APP_NAME-service" --region $AWS_REGION

# Get load balancer DNS name
LB_DNS=$(terraform output -raw load_balancer_dns)

echo "🎉 Deployment completed successfully!"
echo "🌐 Application URL: http://$LB_DNS"
echo "📊 Monitor the deployment:"
echo "   - ECS Console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$APP_NAME-cluster"
echo "   - CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/%2Fecs%2F$APP_NAME"

# Cleanup
rm -f task-definition-updated.json

echo "✅ AWS deployment script completed successfully"