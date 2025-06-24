-- SIMPLIFIED COMPOSITE FOREIGN KEY MIGRATION
-- Critical composite constraints for multi-tenant security

-- Add composite unique constraints to enable composite FKs
ALTER TABLE users ADD CONSTRAINT users_id_tenant_unique UNIQUE (id, tenant_id);
ALTER TABLE clients ADD CONSTRAINT clients_id_tenant_unique UNIQUE (id, tenant_id);
ALTER TABLE shifts ADD CONSTRAINT shifts_id_tenant_unique UNIQUE (id, tenant_id);

-- Add critical composite foreign keys for high-risk relationships
-- Shifts -> Clients (most critical for tenant isolation)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_client_id_clients_id_fk;
ALTER TABLE shifts ADD CONSTRAINT shifts_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

-- Shifts -> Users (staff assignments)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_user_id_users_id_fk;
ALTER TABLE shifts ADD CONSTRAINT shifts_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

-- Case Notes -> Clients
ALTER TABLE case_notes DROP CONSTRAINT IF EXISTS case_notes_client_id_clients_id_fk;
ALTER TABLE case_notes ADD CONSTRAINT case_notes_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

-- Medication Records -> Clients
ALTER TABLE medication_records DROP CONSTRAINT IF EXISTS medication_records_client_id_clients_id_fk;
ALTER TABLE medication_records ADD CONSTRAINT medication_records_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

-- NDIS Budgets -> Clients
ALTER TABLE ndis_budgets DROP CONSTRAINT IF EXISTS ndis_budgets_client_id_clients_id_fk;
ALTER TABLE ndis_budgets ADD CONSTRAINT ndis_budgets_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_shifts_client_tenant ON shifts (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_client_tenant ON case_notes (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_medication_records_client_tenant ON medication_records (client_id, tenant_id);