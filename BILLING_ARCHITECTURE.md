# Standalone Billing System Architecture

## Overview
Separate billing management system for NeedsCareAI+ with tiered per-staff pricing model.

## Current State Analysis
- Multi-tenant architecture with 4 tenants
- Role-based permissions: SupportWorker, TeamLeader, Coordinator, Admin, ConsoleManager
- Tenant provisioning handled in main platform

## Proposed Architecture

### 1. Billing System Components
```
┌─────────────────────────────────────┐
│        Billing Management           │
│                                     │
│  ┌─────────────────────────────────┐│
│  │     Company Management          ││
│  │  - Create/Edit Companies        ││
│  │  - Subscription Management      ││
│  │  - Billing Configuration        ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │     Usage Tracking              ││
│  │  - Active Staff Count           ││
│  │  - Role Distribution            ││
│  │  - Usage Analytics              ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │     Billing Engine              ││
│  │  - 28-day Billing Cycles        ││
│  │  - Tiered Pricing               ││
│  │  - Invoice Generation           ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
                    │
                    │ API Integration
                    ▼
┌─────────────────────────────────────┐
│        Main Platform                │
│                                     │
│  ┌─────────────────────────────────┐│
│  │     User Management             ││
│  │  - Staff Activation/Deactivation││
│  │  - Role Assignment              ││
│  │  - Billing Status Check         ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │     Operational Features        ││
│  │  - Shift Management             ││
│  │  - Care Planning                ││
│  │  - Timesheets                   ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 2. Tiered Pricing Model
- **Support Worker**: $25/month (basic shift access, timesheet)
- **Team Leader**: $35/month (+ shift approval, basic reporting)
- **Coordinator**: $45/month (+ care planning, analytics)
- **Admin**: $60/month (+ full company management, billing access)
- **ConsoleManager**: Platform access (not billable)

### 3. Billing Cycle
- 28-day billing periods
- Pro-rated charges for mid-cycle changes
- Automatic invoicing on cycle completion
- Grace period for payment processing

## Implementation Phases

### Phase 1: Billing Data Model
1. Create billing database schema
2. Company subscription tracking
3. Staff count monitoring
4. Usage analytics collection

### Phase 2: Billing Engine
1. 28-day cycle management
2. Tiered pricing calculation
3. Invoice generation
4. Payment processing integration

### Phase 3: Platform Integration
1. Real-time staff count sync
2. Role change billing updates
3. Activation/deactivation controls
4. Billing status enforcement

### Phase 4: Admin Interface
1. Billing dashboard for ConsoleManager
2. Company management interface
3. Subscription management
4. Usage analytics and reporting

## Technical Considerations

### Security
- Separate databases for billing vs operational data
- API authentication between systems
- Audit logging for all billing operations
- PCI compliance for payment processing

### Scalability
- Independent scaling of billing vs operational systems
- Efficient usage tracking without performance impact
- Batch processing for billing calculations
- Caching for frequently accessed billing data

### Integration Points
- Real-time staff activation/deactivation
- Role change notifications
- Company provisioning workflow
- Usage data synchronization

## Database Schema Extensions

### Billing System Tables
```sql
-- Company subscriptions
CREATE TABLE company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR NOT NULL,
  plan_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL, -- active, suspended, cancelled
  billing_cycle_start DATE NOT NULL,
  next_billing_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff billing records
CREATE TABLE staff_billing (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR NOT NULL,
  monthly_rate DECIMAL(10,2) NOT NULL,
  active_from DATE NOT NULL,
  active_to DATE,
  billing_cycle_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Billing cycles
CREATE TABLE billing_cycles (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR NOT NULL, -- pending, invoiced, paid
  invoice_generated_at TIMESTAMP,
  paid_at TIMESTAMP
);
```

### Main Platform Extensions
```sql
-- Add billing status to users
ALTER TABLE users ADD COLUMN billing_status VARCHAR DEFAULT 'active';
ALTER TABLE users ADD COLUMN billing_rate DECIMAL(10,2);
ALTER TABLE users ADD COLUMN last_billing_sync TIMESTAMP;
```

## API Design

### Billing System APIs
- `GET /api/billing/companies` - List all companies with billing status
- `POST /api/billing/companies` - Create new company subscription
- `GET /api/billing/usage/{companyId}` - Get current usage statistics
- `POST /api/billing/calculate-cycle` - Calculate billing for cycle
- `GET /api/billing/invoices/{companyId}` - Get billing history

### Platform Integration APIs
- `POST /api/sync/staff-changes` - Sync staff additions/removals
- `POST /api/sync/role-changes` - Sync role updates
- `GET /api/billing-status/{companyId}` - Check company billing status
- `POST /api/enforce-billing` - Suspend/activate based on payment status

## Next Steps
1. Review and approve architecture design
2. Implement billing system database schema
3. Create billing calculation engine
4. Build admin interface for company management
5. Integrate with main platform for real-time sync
6. Add payment processing (Stripe/PayPal)
7. Implement usage analytics and reporting