# CRITICAL AWS PRODUCTION DATABASE FIX

## URGENT: Database Connection Issue

### Problem Identified
The live AWS production system is currently using a **hardcoded database connection** instead of the proper environment variable. This causes the same issue we just fixed in development:

```javascript
// PROBLEMATIC CODE IN PRODUCTION
const AWS_DATABASE_URL = "postgres://postgres:mypassword@54.80.195.220:5430/mydb";
const databaseUrl = AWS_DATABASE_URL || process.env.DATABASE_URL;
```

### Impact on Production
- Shifts not persisting properly
- Recurring shift generation failing
- Data inconsistency between API responses and actual database
- Potential data loss or corruption

## IMMEDIATE FIX REQUIRED

### Step 1: Code Fix (Already Applied)
✅ **COMPLETED** - Updated `server/db.ts` to use proper environment variable:
```javascript
// FIXED CODE
const databaseUrl = process.env.DATABASE_URL;
```

### Step 2: AWS Environment Configuration

#### A. Identify Current Production Database
First, determine what the correct production database URL should be:

```bash
# Check current RDS instances
aws rds describe-db-instances --region ap-southeast-2

# Check current secrets manager values
aws secretsmanager get-secret-value --secret-id "needscareai/database-url" --region ap-southeast-2
```

#### B. Update Production Environment
The ECS task definition already has the correct setup to use AWS Secrets Manager:

```json
"secrets": [
  {
    "name": "DATABASE_URL",
    "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:ACCOUNT_ID:secret:needscareai/database-url"
  }
]
```

#### C. Verify Database URL Secret
Update the secret in AWS Secrets Manager with the correct production database URL:

```bash
# Get your actual RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances --region ap-southeast-2 --query 'DBInstances[0].Endpoint.Address' --output text)

# Update the database URL secret with correct production database
aws secretsmanager update-secret \
    --secret-id "needscareai/database-url" \
    --secret-string "postgresql://USERNAME:PASSWORD@$RDS_ENDPOINT:5432/DATABASE_NAME" \
    --region ap-southeast-2
```

### Step 3: Production Deployment

#### Option A: Quick Deployment (Recommended for URGENT fix)
```bash
# Build and push updated image
docker build -t needscareai:hotfix-db .
docker tag needscareai:hotfix-db $ECR_URI:hotfix-db
docker push $ECR_URI:hotfix-db

# Update ECS service with new image
aws ecs update-service \
    --cluster needscareai-cluster \
    --service needscareai-service \
    --force-new-deployment \
    --region ap-southeast-2
```

#### Option B: Full Deployment Script
```bash
# Run the complete deployment script
./deploy-aws.sh
```

### Step 4: Verification

#### A. Check Service Health
```bash
# Monitor deployment status
aws ecs describe-services --cluster needscareai-cluster --services needscareai-service --region ap-southeast-2

# Check application logs
aws logs get-log-events \
    --log-group-name "/ecs/needscareai" \
    --log-stream-name "ecs/needscareai-app/$(date +%Y/%m/%d)" \
    --region ap-southeast-2
```

#### B. Test Application Functionality
1. **Login to production system**
2. **Create a test shift**
3. **Verify shift appears immediately**
4. **Test recurring shift generation**
5. **Confirm data persists after page refresh**

## DATABASE MIGRATION CONSIDERATIONS

### Current Data Assessment
Before applying the fix, assess what data currently exists:

```sql
-- Check current shift data in production database
SELECT COUNT(*) as total_shifts, tenant_id FROM shifts GROUP BY tenant_id;

-- Check for any orphaned data
SELECT * FROM shifts WHERE created_at > NOW() - INTERVAL '7 days';
```

### Data Preservation
If the hardcoded database contains important production data that's not in the "correct" database:

1. **Export critical data** from hardcoded database
2. **Import into correct production database**
3. **Verify data integrity**
4. **Apply the database connection fix**

## ROLLBACK PLAN

If the deployment causes issues:

### Immediate Rollback
```bash
# Rollback to previous task definition
aws ecs update-service \
    --cluster needscareai-cluster \
    --service needscareai-service \
    --task-definition needscareai-task:PREVIOUS_REVISION \
    --region ap-southeast-2
```

### Emergency Access
- Keep the old hardcoded database accessible temporarily
- Monitor CloudWatch logs for any connection errors
- Have database credentials ready for manual intervention

## POST-DEPLOYMENT CHECKLIST

### ✅ Verification Steps
- [ ] Application starts successfully
- [ ] Database connections work
- [ ] Shift creation functions properly
- [ ] Recurring shifts generate correctly
- [ ] All existing data is accessible
- [ ] No data loss occurred
- [ ] Performance is stable

### ✅ Monitoring
- [ ] CloudWatch alerts configured
- [ ] Database connection monitoring active
- [ ] Application error tracking enabled
- [ ] Performance metrics baseline established

## TIMELINE

### Immediate (Within 1 hour)
1. ✅ Code fix applied
2. ⏳ Identify correct production database
3. ⏳ Update AWS Secrets Manager
4. ⏳ Deploy to production

### Short-term (24 hours)
1. ⏳ Verify all functionality
2. ⏳ Monitor for issues
3. ⏳ Document any additional fixes needed

### Long-term (1 week)
1. ⏳ Performance optimization
2. ⏳ Additional monitoring setup
3. ⏳ Documentation updates

## CONTACTS & ESCALATION

### Technical Team
- **Database Admin**: Immediate escalation for DB issues
- **DevOps Team**: For AWS infrastructure problems
- **Application Team**: For application-level issues

### Emergency Procedures
- **AWS Support**: Enterprise support ticket for critical issues
- **Database Backup**: Point-in-time recovery if needed
- **Service Rollback**: Immediate rollback procedures documented

---

**CRITICAL NOTE**: This fix resolves the fundamental database connection inconsistency that's causing shift persistence and recurring generation failures. The production system must be updated as soon as possible to prevent data loss and ensure proper functionality.