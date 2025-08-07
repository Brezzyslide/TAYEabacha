import Stripe from 'stripe';
import { db } from './lib/dbClient';
import { companies, companyPaymentInfo, paymentHistory } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { calculateTenantBilling } from './billing-system';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil',
});

interface CreateSubscriptionResult {
  subscriptionId: string;
  clientSecret: string;
  customerId: string;
}

interface CreatePaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

/**
 * Create or retrieve Stripe customer for a company
 */
export async function createOrGetStripeCustomer(companyId: string): Promise<string> {
  try {
    // Check if company already has a Stripe customer
    const [existingPaymentInfo] = await db
      .select()
      .from(companyPaymentInfo)
      .where(eq(companyPaymentInfo.companyId, companyId))
      .limit(1);

    if (existingPaymentInfo?.stripeCustomerId) {
      // Verify the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(existingPaymentInfo.stripeCustomerId);
        return existingPaymentInfo.stripeCustomerId;
      } catch (error: any) {
        console.error(`[STRIPE] Customer ${existingPaymentInfo.stripeCustomerId} not found, creating new one`);
      }
    }

    // Get company details
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error('Company not found');
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.primaryContactEmail,
      phone: company.primaryContactPhone || undefined,
      metadata: {
        companyId: companyId,
        registrationNumber: company.registrationNumber || '',
      },
    });

    // Update or create payment info
    await db.insert(companyPaymentInfo).values({
      companyId: companyId,
      stripeCustomerId: customer.id,
      paymentStatus: 'pending',
    }).onConflictDoUpdate({
      target: companyPaymentInfo.companyId,
      set: {
        stripeCustomerId: customer.id,
        updatedAt: new Date(),
      }
    });

    console.log(`[STRIPE] Created customer ${customer.id} for company ${companyId}`);
    return customer.id;
  } catch (error: any) {
    console.error('[STRIPE] Error creating customer:', error);
    throw new Error(`Failed to create Stripe customer: ${error.message}`);
  }
}

/**
 * Create a one-time payment intent for a company's bill
 */
export async function createPaymentIntent(companyId: string, tenantId: number): Promise<CreatePaymentIntentResult> {
  try {
    const customerId = await createOrGetStripeCustomer(companyId);
    
    // Calculate current billing amount
    const billing = await calculateTenantBilling(tenantId);
    const amount = Math.round(billing.totalMonthlyRevenue * 100); // Convert to cents

    if (amount <= 0) {
      throw new Error('No billing amount calculated');
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'aud',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        companyId: companyId,
        tenantId: tenantId.toString(),
        billingAmount: billing.totalMonthlyRevenue.toString(),
      },
    });

    // Record payment history entry
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month

    await db.insert(paymentHistory).values({
      companyId: companyId,
      stripePaymentIntentId: paymentIntent.id,
      amount: billing.totalMonthlyRevenue.toString(),
      currency: 'aud',
      status: 'pending',
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      staffSnapshot: billing.roleDistribution,
    });

    console.log(`[STRIPE] Created payment intent ${paymentIntent.id} for ${amount} cents (company ${companyId})`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  } catch (error: any) {
    console.error('[STRIPE] Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
}

/**
 * Create a recurring subscription for a company
 */
export async function createSubscription(companyId: string, tenantId: number): Promise<CreateSubscriptionResult> {
  try {
    const customerId = await createOrGetStripeCustomer(companyId);

    // Check if subscription already exists
    const [existingPaymentInfo] = await db
      .select()
      .from(companyPaymentInfo)
      .where(eq(companyPaymentInfo.companyId, companyId))
      .limit(1);

    if (existingPaymentInfo?.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(existingPaymentInfo.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          const invoice = subscription.latest_invoice as Stripe.Invoice;
          const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
          return {
            subscriptionId: subscription.id,
            clientSecret: paymentIntent?.client_secret || '',
            customerId: customerId,
          };
        }
      } catch (error: any) {
        console.error(`[STRIPE] Subscription ${existingPaymentInfo.stripeSubscriptionId} not found, creating new one`);
      }
    }

    // Calculate current billing to determine price
    const billing = await calculateTenantBilling(tenantId);
    const monthlyAmount = Math.round(billing.totalMonthlyRevenue * 100); // Convert to cents

    if (monthlyAmount <= 0) {
      throw new Error('No billing amount calculated for subscription');
    }

    // Create a price for this specific company's billing
    const price = await stripe.prices.create({
      unit_amount: monthlyAmount,
      currency: 'aud',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `CareConnect Subscription - ${billing.totalActiveStaff} Staff`,
      },
      metadata: {
        companyId: companyId,
        tenantId: tenantId.toString(),
      },
    });

    // Create subscription - this will create an incomplete subscription and invoice
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        companyId: companyId,
        tenantId: tenantId.toString(),
      },
    });

    console.log(`[STRIPE DEBUG] Created subscription ${subscription.id} with status: ${subscription.status}`);

    // Update payment info with safe date handling
    const currentPeriodStart = (subscription as any).current_period_start 
      ? new Date((subscription as any).current_period_start * 1000) 
      : new Date();
    const currentPeriodEnd = (subscription as any).current_period_end 
      ? new Date((subscription as any).current_period_end * 1000) 
      : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days from now as fallback
    const nextPaymentDate = (subscription as any).current_period_end 
      ? new Date((subscription as any).current_period_end * 1000) 
      : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

    await db.insert(companyPaymentInfo).values({
      companyId: companyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      paymentStatus: subscription.status,
      currentPeriodStart: currentPeriodStart,
      currentPeriodEnd: currentPeriodEnd,
      nextPaymentDate: nextPaymentDate,
    }).onConflictDoUpdate({
      target: companyPaymentInfo.companyId,
      set: {
        stripeSubscriptionId: subscription.id,
        paymentStatus: subscription.status,
        currentPeriodStart: currentPeriodStart,
        currentPeriodEnd: currentPeriodEnd,
        nextPaymentDate: nextPaymentDate,
        updatedAt: new Date(),
      }
    });

    console.log(`[STRIPE] Created subscription ${subscription.id} for company ${companyId}`);

    // For incomplete subscriptions, we need to manually get the latest invoice and its payment intent
    let clientSecret = '';
    
    if (subscription.status === 'incomplete' && subscription.latest_invoice) {
      try {
        const invoiceId = typeof subscription.latest_invoice === 'string' 
          ? subscription.latest_invoice 
          : subscription.latest_invoice.id;
          
        console.log(`[STRIPE DEBUG] Retrieving invoice ${invoiceId} for subscription ${subscription.id}`);
        
        const invoice = await stripe.invoices.retrieve(invoiceId, {
          expand: ['payment_intent'],
        });
        
        if (invoice.payment_intent) {
          const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
          clientSecret = paymentIntent.client_secret || '';
          console.log(`[STRIPE DEBUG] Retrieved PaymentIntent ${paymentIntent.id} with status ${paymentIntent.status}, ClientSecret: ${clientSecret ? 'exists' : 'missing'}`);
        } else {
          console.log(`[STRIPE DEBUG] Invoice ${invoiceId} has no payment_intent`);
        }
      } catch (error) {
        console.error(`[STRIPE DEBUG] Error retrieving invoice:`, error);
      }
    }
    
    // If still no client secret, create a new setup intent for future payments
    if (!clientSecret) {
      try {
        console.log(`[STRIPE DEBUG] Creating SetupIntent for subscription ${subscription.id}`);
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          usage: 'off_session',
          metadata: {
            subscriptionId: subscription.id,
            companyId: companyId,
            tenantId: tenantId.toString(),
          },
        });
        
        clientSecret = setupIntent.client_secret || '';
        console.log(`[STRIPE DEBUG] Created SetupIntent ${setupIntent.id}, ClientSecret: ${clientSecret ? 'exists' : 'missing'}`);
      } catch (error) {
        console.error(`[STRIPE DEBUG] Error creating setup intent:`, error);
      }
    }
    
    if (!clientSecret) {
      console.error(`[STRIPE DEBUG] CRITICAL: No client secret available for subscription ${subscription.id}`);
      throw new Error('Unable to create payment setup - no client secret available');
    }
    
    console.log(`[STRIPE DEBUG] Final subscription ${subscription.id} - ClientSecret: EXISTS`);
    
    return {
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
      customerId: customerId,
    };
  } catch (error: any) {
    console.error('[STRIPE] Error creating subscription:', error);
    console.error('[STRIPE] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      companyId,
      tenantId
    });
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
}

/**
 * Update payment status from webhook
 */
export async function updatePaymentStatus(paymentIntentId: string, status: string, paymentDate?: Date) {
  try {
    // Update payment history
    await db.update(paymentHistory)
      .set({
        status: status,
        paymentDate: paymentDate || new Date(),
      })
      .where(eq(paymentHistory.stripePaymentIntentId, paymentIntentId));

    // If payment succeeded, update company payment info
    if (status === 'succeeded') {
      const [payment] = await db
        .select()
        .from(paymentHistory)
        .where(eq(paymentHistory.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      if (payment) {
        await db.update(companyPaymentInfo)
          .set({
            lastPaymentAmount: payment.amount,
            lastPaymentDate: paymentDate || new Date(),
            paymentStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(companyPaymentInfo.companyId, payment.companyId));
      }
    }

    console.log(`[STRIPE] Updated payment status ${paymentIntentId}: ${status}`);
  } catch (error) {
    console.error('[STRIPE] Error updating payment status:', error);
    throw error;
  }
}

/**
 * Get payment information for a company
 */
export async function getCompanyPaymentInfo(companyId: string) {
  try {
    const [paymentInfo] = await db
      .select()
      .from(companyPaymentInfo)
      .where(eq(companyPaymentInfo.companyId, companyId))
      .limit(1);

    // Get recent payment history
    const recentPayments = await db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.companyId, companyId))
      .orderBy(paymentHistory.createdAt)
      .limit(10);

    return {
      paymentInfo,
      recentPayments,
    };
  } catch (error) {
    console.error('[STRIPE] Error getting payment info:', error);
    throw error;
  }
}

export { stripe };