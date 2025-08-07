import { db } from './lib/dbClient';
import { companies, staff, companyPaymentInfo, paymentHistory } from '../shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { calculateTenantBilling } from './billing-system';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface Invoice {
  invoiceNumber: string;
  companyId: string;
  company: {
    name: string;
    businessAddress: string;
    primaryContactName: string;
    primaryContactEmail: string;
  };
  invoiceDate: Date;
  dueDate: Date;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  paymentTerms: string;
  notes?: string;
}

/**
 * Generate invoice number in format: INV-YYYYMM-{companyId-short}-{sequence}
 */
function generateInvoiceNumber(companyId: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const companyShort = companyId.substring(0, 8).toUpperCase();
  const sequence = String(Date.now()).slice(-4);
  
  return `INV-${year}${month}-${companyShort}-${sequence}`;
}

/**
 * Calculate 28-day billing period from a given date
 */
function calculate28DayPeriod(fromDate: Date): { start: Date; end: Date } {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 27); // 28 days total (day 0 to day 27)
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get role-based pricing rates
 */
async function getRolePricing(): Promise<Record<string, number>> {
  // Default rates - these should match your billing system
  return {
    'Admin': 29.99,
    'TeamLeader': 25.99, 
    'Coordinator': 27.99,
    'SupportWorker': 22.99,
    'ConsoleManager': 0.00 // Free access
  };
}

/**
 * Generate detailed invoice for a company's billing period
 */
export async function generateInvoice(
  companyId: string, 
  tenantId: number, 
  billingPeriodStart?: Date
): Promise<Invoice> {
  try {
    console.log(`[INVOICE] Generating invoice for company ${companyId}, tenant ${tenantId}`);

    // Get company details
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error('Company not found');
    }

    // Calculate billing period (28 days from start date or current date)
    const periodStart = billingPeriodStart || new Date();
    const billingPeriod = calculate28DayPeriod(periodStart);
    
    console.log(`[INVOICE] Billing period: ${billingPeriod.start.toISOString()} to ${billingPeriod.end.toISOString()}`);

    // Get current billing data with role breakdown
    const billingData = await calculateTenantBilling(tenantId);
    const rolePricing = await getRolePricing();

    // Create line items for each role
    const lineItems: InvoiceLineItem[] = [];
    let subtotal = 0;

    for (const [roleName, count] of Object.entries(billingData.roleDistribution)) {
      if (count > 0 && roleName !== 'ConsoleManager') { // Exclude free roles
        const unitPrice = rolePricing[roleName] || 0;
        const total = count * unitPrice;
        
        lineItems.push({
          description: `${roleName} Staff Subscription (28-day cycle)`,
          quantity: count,
          unitPrice: unitPrice,
          total: total,
          period: billingPeriod
        });
        
        subtotal += total;
      }
    }

    // Calculate GST (10% in Australia)
    const gstAmount = subtotal * 0.10;
    const totalAmount = subtotal + gstAmount;

    // Generate invoice
    const invoice: Invoice = {
      invoiceNumber: generateInvoiceNumber(companyId, new Date()),
      companyId: companyId,
      company: {
        name: company.name,
        businessAddress: company.businessAddress,
        primaryContactName: company.primaryContactName,
        primaryContactEmail: company.primaryContactEmail,
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from issue
      billingPeriod: billingPeriod,
      lineItems: lineItems,
      subtotal: subtotal,
      gstAmount: gstAmount,
      totalAmount: totalAmount,
      status: 'pending',
      paymentTerms: '14 days net',
      notes: `This invoice covers NeedCareAI+ platform subscription for a 28-day billing cycle. Payment includes access to workforce management, client care planning, and comprehensive analytics features.`
    };

    console.log(`[INVOICE] Generated invoice ${invoice.invoiceNumber} for $${totalAmount.toFixed(2)} AUD`);
    return invoice;

  } catch (error: any) {
    console.error('[INVOICE] Error generating invoice:', error);
    throw new Error(`Failed to generate invoice: ${error.message}`);
  }
}

/**
 * Get invoice data for a company's current billing period
 */
export async function getCurrentInvoice(companyId: string, tenantId: number): Promise<Invoice> {
  // Check if there's payment info to determine the billing start date
  const [paymentInfo] = await db
    .select()
    .from(companyPaymentInfo)
    .where(eq(companyPaymentInfo.companyId, companyId))
    .limit(1);

  let billingStart: Date;
  
  if (paymentInfo?.currentPeriodStart) {
    billingStart = new Date(paymentInfo.currentPeriodStart);
  } else {
    // If no payment info exists, start from today
    billingStart = new Date();
  }

  return generateInvoice(companyId, tenantId, billingStart);
}

/**
 * Mark invoice as paid and record payment history
 */
export async function markInvoicePaid(
  invoiceNumber: string, 
  companyId: string, 
  paymentIntentId: string,
  paidAmount: number
): Promise<void> {
  try {
    const now = new Date();
    const billingPeriod = calculate28DayPeriod(now);

    // Record payment in history
    await db.insert(paymentHistory).values({
      companyId: companyId,
      stripePaymentIntentId: paymentIntentId,
      amount: paidAmount.toString(),
      currency: 'aud',
      status: 'succeeded',
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      invoiceNumber: invoiceNumber,
      paidAt: now,
    });

    console.log(`[INVOICE] Marked invoice ${invoiceNumber} as paid: $${paidAmount} AUD`);
  } catch (error: any) {
    console.error('[INVOICE] Error marking invoice as paid:', error);
    throw new Error(`Failed to mark invoice as paid: ${error.message}`);
  }
}

/**
 * Get invoice history for a company
 */
export async function getInvoiceHistory(companyId: string): Promise<Invoice[]> {
  try {
    // Get payment history records
    const payments = await db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.companyId, companyId))
      .orderBy(sql`${paymentHistory.createdAt} DESC`)
      .limit(12); // Last 12 invoices

    const invoices: Invoice[] = [];

    for (const payment of payments) {
      if (payment.billingPeriodStart && payment.billingPeriodEnd) {
        try {
          const invoice = await generateInvoice(
            companyId, 
            0, // We'll need to get tenantId from company if needed
            new Date(payment.billingPeriodStart)
          );
          
          // Override with actual payment data
          invoice.invoiceNumber = payment.invoiceNumber || invoice.invoiceNumber;
          invoice.status = payment.status === 'succeeded' ? 'paid' : 'pending';
          invoice.totalAmount = parseFloat(payment.amount);
          
          invoices.push(invoice);
        } catch (error) {
          console.error(`[INVOICE] Error reconstructing invoice for payment ${payment.id}:`, error);
        }
      }
    }

    return invoices;
  } catch (error: any) {
    console.error('[INVOICE] Error getting invoice history:', error);
    return [];
  }
}