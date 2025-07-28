#!/bin/bash
# CRITICAL AWS PRODUCTION HOTFIX DEPLOYMENT
# Fixes database connection issue in live production system

set -e

echo "🚨 CRITICAL HOTFIX: Deploying database connection fix to AWS production"
echo "This fixes the hardcoded database URL issue causing shift persistence failures"

# Configuration
AWS_REGION="ap-southeast-2"
ECR_REPO_NAME="needscareai"
APP_NAME="needscareai"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Failed to get AWS Account ID. Please check AWS credentials."
    exit 1
fi

echo "📋 AWS Account ID: $AWS_ACCOUNT_ID"
echo "📋 Region: $AWS_REGION"

# Step 1: Verify current production database
echo "🔍 Checking current production database configuration..."

# Check current RDS instances
echo "📊 Current RDS instances:"
aws rds describe-db-instances --region $AWS_REGION --query 'DBInstances[].{Identifier:DBInstanceIdentifier,Endpoint:Endpoint.Address,Status:DBInstanceStatus}' --output table

# Check current database URL secret
echo "🔐 Current database URL secret:"
CURRENT_DB_URL=$(aws secretsmanager get-secret-value --secret-id "$APP_NAME/database-url" --region $AWS_REGION --query 'SecretString' --output text 2>/dev/null || echo "SECRET_NOT_FOUND")
echo "Current DATABASE_URL: $CURRENT_DB_URL"

# Step 2: Identify correct production database
echo ""
echo "⚠️  CRITICAL DECISION REQUIRED:"
echo "We found the hardcoded database was: postgres://postgres:mypassword@54.80.195.220:5430/mydb"
echo "Current secret DATABASE_URL is: $CURRENT_DB_URL"
echo ""
echo "Please choose the correct production database:"
echo "1. Use the RDS instance shown above (recommended for proper AWS setup)"
echo "2. Keep using 54.80.195.220:5430/mydb (current hardcoded database)"
echo "3. Specify a different database URL"

read -p "Enter choice (1/2/3): " DB_CHOICE

case $DB_CHOICE in
    1)
        # Use RDS instance
        RDS_ENDPOINT=$(aws rds describe-db-instances --region $AWS_REGION --query 'DBInstances[0].Endpoint.Address' --output text)
        echo "📝 Using RDS endpoint: $RDS_ENDPOINT"
        read -p "Enter database username (e.g., needscareai_admin): " DB_USERNAME
        read -s -p "Enter database password: " DB_PASSWORD
        echo ""
        read -p "Enter database name (e.g., needscareai_production): " DB_NAME
        NEW_DB_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$RDS_ENDPOINT:5432/$DB_NAME"
        ;;
    2)
        # Keep using hardcoded database
        echo "📝 Keeping hardcoded database connection"
        NEW_DB_URL="postgres://postgres:mypassword@54.80.195.220:5430/mydb"
        ;;
    3)
        # Custom database URL
        read -p "Enter complete database URL: " NEW_DB_URL
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo "🎯 Selected database URL: $NEW_DB_URL"

# Step 3: Update database URL secret
echo "🔐 Updating database URL secret in AWS Secrets Manager..."
aws secretsmanager update-secret \
    --secret-id "$APP_NAME/database-url" \
    --secret-string "$NEW_DB_URL" \
    --region $AWS_REGION

echo "✅ Database URL secret updated successfully"

# Step 4: Build and push updated Docker image
echo "🐳 Building and pushing updated Docker image..."

# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image with hotfix tag
echo "🔨 Building Docker image with database fix..."
docker build -t $ECR_REPO_NAME:hotfix-db-$(date +%Y%m%d-%H%M) .

# Tag and push image
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:hotfix-db-$(date +%Y%m%d-%H%M)"
docker tag $ECR_REPO_NAME:hotfix-db-$(date +%Y%m%d-%H%M) $ECR_URI
docker push $ECR_URI

# Also update latest tag
docker tag $ECR_REPO_NAME:hotfix-db-$(date +%Y%m%d-%H%M) $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest

echo "✅ Docker image pushed to ECR: $ECR_URI"

# Step 5: Update ECS task definition
echo "🚀 Updating ECS task definition..."

# Create updated task definition
sed "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" aws-ecs-task-definition.json > task-definition-hotfix.json

# Register new task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://task-definition-hotfix.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "📋 New Task Definition ARN: $TASK_DEFINITION_ARN"

# Step 6: Deploy to ECS service
echo "🔄 Deploying to ECS service with force new deployment..."
aws ecs update-service \
    --cluster "$APP_NAME-cluster" \
    --service "$APP_NAME-service" \
    --task-definition "$TASK_DEFINITION_ARN" \
    --force-new-deployment \
    --region $AWS_REGION

# Step 7: Monitor deployment
echo "⏳ Monitoring deployment progress..."
echo "📊 ECS service update initiated. Monitoring stability..."

# Wait for deployment to stabilize
aws ecs wait services-stable \
    --cluster "$APP_NAME-cluster" \
    --services "$APP_NAME-service" \
    --region $AWS_REGION

# Get load balancer DNS for testing
LB_DNS=$(aws elbv2 describe-load-balancers \
    --region $AWS_REGION \
    --query 'LoadBalancers[?contains(LoadBalancerName, `needscareai`)].DNSName' \
    --output text)

echo ""
echo "🎉 HOTFIX DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
echo "📊 Deployment Summary:"
echo "   - Database connection fix applied"
echo "   - New database URL: $NEW_DB_URL"
echo "   - Docker image: $ECR_URI"
echo "   - Task definition: $TASK_DEFINITION_ARN"
echo ""
echo "🌐 Application URL: http://$LB_DNS"
echo ""
echo "✅ CRITICAL VERIFICATION STEPS:"
echo "1. Test login at: http://$LB_DNS"
echo "2. Create a test shift"
echo "3. Verify shift appears immediately"
echo "4. Test recurring shift generation"
echo "5. Refresh page and confirm shift persists"
echo ""
echo "📊 Monitor the deployment:"
echo "   - ECS Console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$APP_NAME-cluster"
echo "   - CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/%2Fecs%2F$APP_NAME"
echo ""
echo "🚨 If issues occur, rollback with:"
echo "   aws ecs update-service --cluster $APP_NAME-cluster --service $APP_NAME-service --task-definition <PREVIOUS_TASK_DEFINITION>"

# Cleanup
rm -f task-definition-hotfix.json

echo "✅ CRITICAL HOTFIX DEPLOYMENT COMPLETED"
echo "🔥 The shift persistence and recurring generation issues should now be resolved!"