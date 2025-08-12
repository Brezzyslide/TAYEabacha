import { z } from 'zod';

// Base validation schemas
export const billingDetailsSchema = z.object({
  participantNumber: z.string().min(1, "Participant number is required"),
  planNumber: z.string().min(1, "Plan number is required"),
  planManager: z.string().optional(),
  planManagerContact: z.string().optional(),
});

export const serviceAgreementCreateSchema = z.object({
  clientId: z.number().int().positive("Client ID must be a positive integer"),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid end date"),
  planNomineeName: z.string().optional(),
  planNomineeContact: z.string().optional(),
  billingDetails: billingDetailsSchema,
  customTerms: z.string().optional(),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return startDate <= endDate;
}, {
  message: "Start date must be before or equal to end date",
  path: ["endDate"],
});

export const serviceAgreementUpdateSchema = z.object({
  clientId: z.number().int().positive().optional(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid start date").optional(),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid end date").optional(),
  planNomineeName: z.string().optional(),
  planNomineeContact: z.string().optional(),
  billingDetails: billingDetailsSchema.optional(),
  customTerms: z.string().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return startDate <= endDate;
  }
  return true;
}, {
  message: "Start date must be before or equal to end date",
  path: ["endDate"],
});

export const serviceAgreementItemCreateSchema = z.object({
  ndisCode: z.string().min(1, "NDIS code is required"),
  supportDescription: z.string().min(1, "Support description is required"),
  weeks: z.number().int().min(1, "Weeks must be at least 1"),
  
  // Hours fields as numbers
  hoursDay: z.number().min(0, "Day hours must be non-negative").default(0),
  hoursEvening: z.number().min(0, "Evening hours must be non-negative").default(0),
  hoursActiveNight: z.number().min(0, "Active night hours must be non-negative").default(0),
  hoursSleepover: z.number().min(0, "Sleepover hours must be non-negative").default(0),
  hoursSaturday: z.number().min(0, "Saturday hours must be non-negative").default(0),
  hoursSunday: z.number().min(0, "Sunday hours must be non-negative").default(0),
  hoursPublicHoliday: z.number().min(0, "Public holiday hours must be non-negative").default(0),
  
  // Unit rate fields as numbers (will be converted to Decimal internally)
  unitDay: z.number().min(0, "Day rate must be non-negative").default(0),
  unitEvening: z.number().min(0, "Evening rate must be non-negative").default(0),
  unitActiveNight: z.number().min(0, "Active night rate must be non-negative").default(0),
  unitSleepover: z.number().min(0, "Sleepover rate must be non-negative").default(0),
  unitSaturday: z.number().min(0, "Saturday rate must be non-negative").default(0),
  unitSunday: z.number().min(0, "Sunday rate must be non-negative").default(0),
  unitPublicHoliday: z.number().min(0, "Public holiday rate must be non-negative").default(0),
  
  notes: z.string().optional(),
});

export const serviceAgreementItemUpdateSchema = serviceAgreementItemCreateSchema.partial();

export const signatureCreateSchema = z.object({
  signerRole: z.enum(['participant', 'nominee', 'provider', 'witness'], {
    errorMap: () => ({ message: "Signer role must be one of: participant, nominee, provider, witness" }),
  }),
  signerName: z.string().min(1, "Signer name is required"),
});

export const clientIdQuerySchema = z.object({
  clientId: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
}).refine((data) => {
  if (data.clientId !== undefined && (isNaN(data.clientId) || data.clientId <= 0)) {
    return false;
  }
  return true;
}, {
  message: "Client ID must be a positive integer",
  path: ["clientId"],
});

// Helper function to convert numbers to Decimal strings for database operations
export const convertToDecimalStrings = (data: any) => {
  const decimalFields = [
    'unitDay', 'unitEvening', 'unitActiveNight', 'unitSleepover',
    'unitSaturday', 'unitSunday', 'unitPublicHoliday'
  ];
  
  const converted = { ...data };
  decimalFields.forEach(field => {
    if (typeof converted[field] === 'number') {
      converted[field] = converted[field].toString();
    }
  });
  
  return converted;
};

// Helper function to convert Decimal strings back to numbers for API responses
export const convertFromDecimalStrings = (data: any) => {
  const decimalFields = [
    'unitDay', 'unitEvening', 'unitActiveNight', 'unitSleepover',
    'unitSaturday', 'unitSunday', 'unitPublicHoliday'
  ];
  
  const converted = { ...data };
  decimalFields.forEach(field => {
    if (typeof converted[field] === 'string') {
      converted[field] = parseFloat(converted[field]);
    }
  });
  
  return converted;
};