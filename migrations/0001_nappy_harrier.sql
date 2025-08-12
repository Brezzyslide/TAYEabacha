CREATE TABLE "company_payment_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"payment_status" text DEFAULT 'pending',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"next_payment_date" timestamp,
	"last_payment_amount" numeric(10, 2),
	"last_payment_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_payment_info_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "company_payment_info_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'aud' NOT NULL,
	"status" text NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"staff_snapshot" jsonb,
	"payment_date" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_history_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
ALTER TABLE "company_payment_info" ADD CONSTRAINT "company_payment_info_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;