-- Add payment tables for Stripe integration
-- Created: 2025-08-07

-- Company Payment Information
CREATE TABLE IF NOT EXISTS company_payment_info (
    id SERIAL PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    payment_status TEXT DEFAULT 'pending', -- pending, active, past_due, canceled
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    next_payment_date TIMESTAMP,
    last_payment_amount DECIMAL(10,2),
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(company_id)
);

-- Payment History
CREATE TABLE IF NOT EXISTS payment_history (
    id SERIAL PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'aud' NOT NULL,
    status TEXT NOT NULL, -- succeeded, failed, pending, canceled
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    staff_snapshot JSONB, -- Snapshot of staff counts at time of billing
    payment_date TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_payment_info_company_id ON company_payment_info(company_id);
CREATE INDEX IF NOT EXISTS idx_company_payment_info_stripe_customer_id ON company_payment_info(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_company_payment_info_stripe_subscription_id ON company_payment_info(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_company_id ON payment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_stripe_payment_intent_id ON payment_history(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE company_payment_info TO postgres;
GRANT ALL PRIVILEGES ON TABLE payment_history TO postgres;
GRANT USAGE, SELECT ON SEQUENCE company_payment_info_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE payment_history_id_seq TO postgres;