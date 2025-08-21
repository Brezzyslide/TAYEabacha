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
  weeks: z.coerce.number().int().min(1, "Weeks must be at least 1"),
  
  // Hours fields - handle empty strings and convert to numbers
  hoursDay: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Day hours must be non-negative")),
  hoursWeekdayEvening: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Evening hours must be non-negative")),
  hoursActiveNight: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Active night hours must be non-negative")),
  hoursSleepover: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Sleepover hours must be non-negative")),
  hoursSaturday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Saturday hours must be non-negative")),
  hoursSunday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Sunday hours must be non-negative")),
  hoursPublicHoliday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Public holiday hours must be non-negative")),
  
  // Unit rate fields - handle empty strings and convert to numbers
  unitDay: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Day rate must be non-negative")),
  unitWeekdayEvening: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Evening rate must be non-negative")),
  unitActiveNight: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Active night rate must be non-negative")),
  unitSleepover: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Sleepover rate must be non-negative")),
  unitSaturday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Saturday rate must be non-negative")),
  unitSunday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Sunday rate must be non-negative")),
  unitPublicHoliday: z.union([z.string(), z.number()]).transform(val => val === "" || val === null || val === undefined ? 0 : Number(val)).pipe(z.number().min(0, "Public holiday rate must be non-negative")),
  
  notes: z.string().optional().nullable(),
});

export const serviceAgreementItemUpdateSchema = serviceAgreementItemCreateSchema.partial();

export const signatureCreateSchema = z.object({
  signerRole: z.enum(['organisation', 'client', 'nominee'], {
    errorMap: () => ({ message: "Signer role must be one of: organisation, client, nominee" }),
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
    // Hours fields (camelCase and snake_case)
    'hoursDay', 'hoursWeekdayEvening', 'hoursActiveNight', 'hoursSleepover',
    'hoursSaturday', 'hoursSunday', 'hoursPublicHoliday',
    'hours_day', 'hours_weekday_evening', 'hours_active_night', 'hours_sleepover',
    'hours_saturday', 'hours_sunday', 'hours_public_holiday',
    // Unit rate fields (camelCase and snake_case)
    'unitDay', 'unitWeekdayEvening', 'unitActiveNight', 'unitSleepover',
    'unitSaturday', 'unitSunday', 'unitPublicHoliday',
    'unit_day', 'unit_weekday_evening', 'unit_active_night', 'unit_sleepover',
    'unit_saturday', 'unit_sunday', 'unit_public_holiday'
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
  const allFields = [
    // Hours fields (camelCase and snake_case)
    'hoursDay', 'hoursWeekdayEvening', 'hoursActiveNight', 'hoursSleepover',
    'hoursSaturday', 'hoursSunday', 'hoursPublicHoliday',
    'hours_day', 'hours_weekday_evening', 'hours_active_night', 'hours_sleepover',
    'hours_saturday', 'hours_sunday', 'hours_public_holiday',
    // Unit rate fields (camelCase and snake_case)
    'unitDay', 'unitWeekdayEvening', 'unitActiveNight', 'unitSleepover',
    'unitSaturday', 'unitSunday', 'unitPublicHoliday',
    'unit_day', 'unit_weekday_evening', 'unit_active_night', 'unit_sleepover',
    'unit_saturday', 'unit_sunday', 'unit_public_holiday'
  ];
  
  const converted = { ...data };
  allFields.forEach(field => {
    if (typeof converted[field] === 'string') {
      const numValue = parseFloat(converted[field]);
      converted[field] = isNaN(numValue) ? 0 : numValue;
    }
  });
  
  return converted;
};