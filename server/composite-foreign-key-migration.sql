-- COMPOSITE FOREIGN KEY MIGRATION
-- Implements database-level tenant isolation through composite foreign keys
-- This migration addresses the critical security gap where cross-tenant joins could occur at schema level

-- =======================
-- STEP 1: ADD TENANT CONTEXT TO PARENT TABLES
-- =======================

-- Add composite unique constraints to parent tables to enable composite FKs
-- These constraints ensure each record can be uniquely identified by (id, tenantId)

-- Users table (referenced by many tables)
ALTER TABLE users ADD CONSTRAINT users_id_tenant_unique UNIQUE (id, tenant_id);

-- Clients table (referenced by many tables)
ALTER TABLE clients ADD CONSTRAINT clients_id_tenant_unique UNIQUE (id, tenant_id);

-- Shifts table (referenced by cancellations, case notes, etc.)
ALTER TABLE shifts ADD CONSTRAINT shifts_id_tenant_unique UNIQUE (id, tenant_id);

-- Form templates table
ALTER TABLE form_templates ADD CONSTRAINT form_templates_id_tenant_unique UNIQUE (id, tenant_id);

-- Medication plans table
ALTER TABLE medication_plans ADD CONSTRAINT medication_plans_id_tenant_unique UNIQUE (id, tenant_id);

-- Custom roles table
ALTER TABLE custom_roles ADD CONSTRAINT custom_roles_id_tenant_unique UNIQUE (id, tenant_id);

-- NDIS budgets table
ALTER TABLE ndis_budgets ADD CONSTRAINT ndis_budgets_id_tenant_unique UNIQUE (id, tenant_id);

-- Timesheets table
ALTER TABLE timesheets ADD CONSTRAINT timesheets_id_tenant_unique UNIQUE (id, tenant_id);

-- Case notes table
ALTER TABLE case_notes ADD CONSTRAINT case_notes_id_tenant_unique UNIQUE (id, tenant_id);

-- =======================
-- STEP 2: DROP EXISTING SINGLE-COLUMN FOREIGN KEYS
-- =======================

-- Drop existing foreign key constraints that will be replaced with composite ones
-- Note: Constraint names may vary, using IF EXISTS for safety

-- Clients table
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_created_by_users_id_fk;

-- Form templates table
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_created_by_users_id_fk;

-- Form submissions table
ALTER TABLE form_submissions DROP CONSTRAINT IF EXISTS form_submissions_template_id_form_templates_id_fk;
ALTER TABLE form_submissions DROP CONSTRAINT IF EXISTS form_submissions_client_id_clients_id_fk;
ALTER TABLE form_submissions DROP CONSTRAINT IF EXISTS form_submissions_submitted_by_users_id_fk;

-- Shifts table
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_user_id_users_id_fk;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_client_id_clients_id_fk;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_handover_received_from_staff_id_users_id_fk;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_handover_given_to_staff_id_users_id_fk;

-- Shift cancellations table
ALTER TABLE shift_cancellations DROP CONSTRAINT IF EXISTS shift_cancellations_shift_id_shifts_id_fk;
ALTER TABLE shift_cancellations DROP CONSTRAINT IF EXISTS shift_cancellations_cancelled_by_user_id_users_id_fk;
ALTER TABLE shift_cancellations DROP CONSTRAINT IF EXISTS shift_cancellations_approved_by_user_id_users_id_fk;

-- Cancellation requests table
ALTER TABLE cancellation_requests DROP CONSTRAINT IF EXISTS cancellation_requests_shift_id_shifts_id_fk;
ALTER TABLE cancellation_requests DROP CONSTRAINT IF EXISTS cancellation_requests_requested_by_user_id_users_id_fk;
ALTER TABLE cancellation_requests DROP CONSTRAINT IF EXISTS cancellation_requests_reviewed_by_user_id_users_id_fk;

-- Staff availability table
ALTER TABLE staff_availability DROP CONSTRAINT IF EXISTS staff_availability_user_id_users_id_fk;

-- Case notes table
ALTER TABLE case_notes DROP CONSTRAINT IF EXISTS case_notes_client_id_clients_id_fk;
ALTER TABLE case_notes DROP CONSTRAINT IF EXISTS case_notes_user_id_users_id_fk;
ALTER TABLE case_notes DROP CONSTRAINT IF EXISTS case_notes_linked_shift_id_shifts_id_fk;

-- Hourly observations table
ALTER TABLE hourly_observations DROP CONSTRAINT IF EXISTS hourly_observations_client_id_clients_id_fk;
ALTER TABLE hourly_observations DROP CONSTRAINT IF EXISTS hourly_observations_user_id_users_id_fk;

-- Medication plans table
ALTER TABLE medication_plans DROP CONSTRAINT IF EXISTS medication_plans_client_id_clients_id_fk;
ALTER TABLE medication_plans DROP CONSTRAINT IF EXISTS medication_plans_created_by_users_id_fk;

-- Medication records table
ALTER TABLE medication_records DROP CONSTRAINT IF EXISTS medication_records_medication_plan_id_medication_plans_id_fk;
ALTER TABLE medication_records DROP CONSTRAINT IF EXISTS medication_records_client_id_clients_id_fk;
ALTER TABLE medication_records DROP CONSTRAINT IF EXISTS medication_records_administered_by_users_id_fk;

-- Activity logs table
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_users_id_fk;

-- Incident reports table
ALTER TABLE incident_reports DROP CONSTRAINT IF EXISTS incident_reports_client_id_clients_id_fk;
ALTER TABLE incident_reports DROP CONSTRAINT IF EXISTS incident_reports_staff_id_users_id_fk;

-- Incident closures table
ALTER TABLE incident_closures DROP CONSTRAINT IF EXISTS incident_closures_closed_by_users_id_fk;

-- Staff messages table
ALTER TABLE staff_messages DROP CONSTRAINT IF EXISTS staff_messages_sender_id_users_id_fk;

-- Hour allocations table
ALTER TABLE hour_allocations DROP CONSTRAINT IF EXISTS hour_allocations_staff_id_users_id_fk;

-- Custom roles table
ALTER TABLE custom_roles DROP CONSTRAINT IF EXISTS custom_roles_created_by_users_id_fk;

-- Custom permissions table
ALTER TABLE custom_permissions DROP CONSTRAINT IF EXISTS custom_permissions_role_id_custom_roles_id_fk;
ALTER TABLE custom_permissions DROP CONSTRAINT IF EXISTS custom_permissions_created_by_users_id_fk;

-- User role assignments table
ALTER TABLE user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_user_id_users_id_fk;
ALTER TABLE user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_role_id_custom_roles_id_fk;
ALTER TABLE user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_assigned_by_users_id_fk;

-- Notifications table
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk;

-- Task board tasks table
ALTER TABLE task_board_tasks DROP CONSTRAINT IF EXISTS task_board_tasks_assigned_to_user_id_users_id_fk;
ALTER TABLE task_board_tasks DROP CONSTRAINT IF EXISTS task_board_tasks_created_by_user_id_users_id_fk;

-- NDIS budgets table
ALTER TABLE ndis_budgets DROP CONSTRAINT IF EXISTS ndis_budgets_client_id_clients_id_fk;

-- Budget transactions table
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_budget_id_ndis_budgets_id_fk;
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_shift_id_shifts_id_fk;
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_case_note_id_case_notes_id_fk;
ALTER TABLE budget_transactions DROP CONSTRAINT IF EXISTS budget_transactions_created_by_user_id_users_id_fk;

-- Care support plans table
ALTER TABLE care_support_plans DROP CONSTRAINT IF EXISTS care_support_plans_client_id_clients_id_fk;
ALTER TABLE care_support_plans DROP CONSTRAINT IF EXISTS care_support_plans_created_by_user_id_users_id_fk;

-- Timesheets table
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_user_id_users_id_fk;
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_approved_by_users_id_fk;
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_paid_by_users_id_fk;

-- Timesheet entries table
ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_timesheet_id_timesheets_id_fk;
ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_shift_id_shifts_id_fk;

-- Leave balances table
ALTER TABLE leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_users_id_fk;

-- Payslips table
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_timesheet_id_timesheets_id_fk;
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_user_id_users_id_fk;

-- =======================
-- STEP 3: ADD COMPOSITE FOREIGN KEY CONSTRAINTS
-- =======================

-- Add composite foreign keys to enforce tenant isolation at database level
-- Format: FOREIGN KEY (referenced_id, tenant_id) REFERENCES parent_table (id, tenant_id)

-- Clients table
ALTER TABLE clients 
ADD CONSTRAINT clients_created_by_tenant_fk 
FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Form templates table
ALTER TABLE form_templates 
ADD CONSTRAINT form_templates_created_by_tenant_fk 
FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Form submissions table
ALTER TABLE form_submissions 
ADD CONSTRAINT form_submissions_template_tenant_fk 
FOREIGN KEY (template_id, tenant_id) REFERENCES form_templates (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE form_submissions 
ADD CONSTRAINT form_submissions_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE form_submissions 
ADD CONSTRAINT form_submissions_submitted_by_tenant_fk 
FOREIGN KEY (submitted_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Shifts table
ALTER TABLE shifts 
ADD CONSTRAINT shifts_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

ALTER TABLE shifts 
ADD CONSTRAINT shifts_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE shifts 
ADD CONSTRAINT shifts_handover_received_tenant_fk 
FOREIGN KEY (handover_received_from_staff_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

ALTER TABLE shifts 
ADD CONSTRAINT shifts_handover_given_tenant_fk 
FOREIGN KEY (handover_given_to_staff_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

-- Shift cancellations table
ALTER TABLE shift_cancellations 
ADD CONSTRAINT shift_cancellations_shift_tenant_fk 
FOREIGN KEY (shift_id, tenant_id) REFERENCES shifts (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE shift_cancellations 
ADD CONSTRAINT shift_cancellations_cancelled_by_tenant_fk 
FOREIGN KEY (cancelled_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE shift_cancellations 
ADD CONSTRAINT shift_cancellations_approved_by_tenant_fk 
FOREIGN KEY (approved_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

-- Cancellation requests table
ALTER TABLE cancellation_requests 
ADD CONSTRAINT cancellation_requests_shift_tenant_fk 
FOREIGN KEY (shift_id, tenant_id) REFERENCES shifts (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE cancellation_requests 
ADD CONSTRAINT cancellation_requests_requested_by_tenant_fk 
FOREIGN KEY (requested_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE cancellation_requests 
ADD CONSTRAINT cancellation_requests_reviewed_by_tenant_fk 
FOREIGN KEY (reviewed_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

-- Staff availability table
ALTER TABLE staff_availability 
ADD CONSTRAINT staff_availability_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Case notes table
ALTER TABLE case_notes 
ADD CONSTRAINT case_notes_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE case_notes 
ADD CONSTRAINT case_notes_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE case_notes 
ADD CONSTRAINT case_notes_linked_shift_tenant_fk 
FOREIGN KEY (linked_shift_id, tenant_id) REFERENCES shifts (id, tenant_id) ON DELETE SET NULL;

-- Hourly observations table
ALTER TABLE hourly_observations 
ADD CONSTRAINT hourly_observations_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE hourly_observations 
ADD CONSTRAINT hourly_observations_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Medication plans table
ALTER TABLE medication_plans 
ADD CONSTRAINT medication_plans_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE medication_plans 
ADD CONSTRAINT medication_plans_created_by_tenant_fk 
FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Medication records table
ALTER TABLE medication_records 
ADD CONSTRAINT medication_records_plan_tenant_fk 
FOREIGN KEY (medication_plan_id, tenant_id) REFERENCES medication_plans (id, tenant_id) ON DELETE SET NULL;

ALTER TABLE medication_records 
ADD CONSTRAINT medication_records_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE medication_records 
ADD CONSTRAINT medication_records_administered_by_tenant_fk 
FOREIGN KEY (administered_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Activity logs table
ALTER TABLE activity_logs 
ADD CONSTRAINT activity_logs_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Incident reports table
ALTER TABLE incident_reports 
ADD CONSTRAINT incident_reports_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE incident_reports 
ADD CONSTRAINT incident_reports_staff_tenant_fk 
FOREIGN KEY (staff_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Incident closures table
ALTER TABLE incident_closures 
ADD CONSTRAINT incident_closures_closed_by_tenant_fk 
FOREIGN KEY (closed_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Staff messages table
ALTER TABLE staff_messages 
ADD CONSTRAINT staff_messages_sender_tenant_fk 
FOREIGN KEY (sender_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Hour allocations table
ALTER TABLE hour_allocations 
ADD CONSTRAINT hour_allocations_staff_tenant_fk 
FOREIGN KEY (staff_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Custom roles table
ALTER TABLE custom_roles 
ADD CONSTRAINT custom_roles_created_by_tenant_fk 
FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Custom permissions table
ALTER TABLE custom_permissions 
ADD CONSTRAINT custom_permissions_role_tenant_fk 
FOREIGN KEY (role_id, tenant_id) REFERENCES custom_roles (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE custom_permissions 
ADD CONSTRAINT custom_permissions_created_by_tenant_fk 
FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- User role assignments table
ALTER TABLE user_role_assignments 
ADD CONSTRAINT user_role_assignments_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments 
ADD CONSTRAINT user_role_assignments_role_tenant_fk 
FOREIGN KEY (role_id, tenant_id) REFERENCES custom_roles (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments 
ADD CONSTRAINT user_role_assignments_assigned_by_tenant_fk 
FOREIGN KEY (assigned_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Notifications table
ALTER TABLE notifications 
ADD CONSTRAINT notifications_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Task board tasks table
ALTER TABLE task_board_tasks 
ADD CONSTRAINT task_board_tasks_assigned_to_tenant_fk 
FOREIGN KEY (assigned_to_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

ALTER TABLE task_board_tasks 
ADD CONSTRAINT task_board_tasks_created_by_tenant_fk 
FOREIGN KEY (created_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- NDIS budgets table
ALTER TABLE ndis_budgets 
ADD CONSTRAINT ndis_budgets_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

-- Budget transactions table (Note: budget_transactions doesn't have tenant_id column directly)
-- Skip composite FK for budget_transactions as it uses company_id instead of tenant_id

-- Care support plans table
ALTER TABLE care_support_plans 
ADD CONSTRAINT care_support_plans_client_tenant_fk 
FOREIGN KEY (client_id, tenant_id) REFERENCES clients (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE care_support_plans 
ADD CONSTRAINT care_support_plans_created_by_tenant_fk 
FOREIGN KEY (created_by_user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE RESTRICT;

-- Timesheets table
ALTER TABLE timesheets 
ADD CONSTRAINT timesheets_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

ALTER TABLE timesheets 
ADD CONSTRAINT timesheets_approved_by_tenant_fk 
FOREIGN KEY (approved_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

ALTER TABLE timesheets 
ADD CONSTRAINT timesheets_paid_by_tenant_fk 
FOREIGN KEY (paid_by, tenant_id) REFERENCES users (id, tenant_id) ON DELETE SET NULL;

-- Leave balances table
ALTER TABLE leave_balances 
ADD CONSTRAINT leave_balances_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Payslips table
ALTER TABLE payslips 
ADD CONSTRAINT payslips_user_tenant_fk 
FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id) ON DELETE CASCADE;

-- Re-add timesheet FK for payslips
ALTER TABLE payslips 
ADD CONSTRAINT payslips_timesheet_tenant_fk 
FOREIGN KEY (timesheet_id, tenant_id) REFERENCES timesheets (id, tenant_id) ON DELETE CASCADE;

-- =======================
-- STEP 4: ADD INDEXES FOR PERFORMANCE
-- =======================

-- Add indexes on composite foreign key columns for optimal query performance
CREATE INDEX IF NOT EXISTS idx_clients_created_by_tenant ON clients (created_by, tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_tenant ON shifts (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_client_tenant ON shifts (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_client_tenant ON case_notes (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_user_tenant ON case_notes (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_medication_plans_client_tenant ON medication_plans (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_medication_records_client_tenant ON medication_records (client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_hour_allocations_staff_tenant ON hour_allocations (staff_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_tenant ON timesheets (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_tenant ON notifications (user_id, tenant_id);

-- =======================
-- VERIFICATION QUERIES
-- =======================

-- These queries can be used to verify the composite foreign keys are working correctly
-- Uncomment to test after migration

-- Test 1: Verify composite constraints exist
-- SELECT 
--     tc.table_name, 
--     tc.constraint_name, 
--     string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_schema = 'public'
--   AND kcu.column_name LIKE '%tenant%'
-- GROUP BY tc.table_name, tc.constraint_name
-- ORDER BY tc.table_name;

-- Test 2: Attempt cross-tenant violation (should fail)
-- INSERT INTO case_notes (client_id, tenant_id, user_id, title, content) 
-- VALUES (1, 999, 1, 'Test', 'This should fail due to tenant mismatch');

COMMIT;