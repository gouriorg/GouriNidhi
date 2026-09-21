import { z } from 'zod'

import { isValidDateOnly } from '@/lib/dates'

const paiseSchema = z
  .number()
  .int('Amounts are stored as whole paise')
  .nonnegative('Amount cannot be negative')
  .finite()

const dateOnlySchema = z.string().refine(isValidDateOnly, 'Use a valid date (yyyy-MM-dd)')
const timestampSchema = z.string().min(1)
const idSchema = z.string().min(1)

/** Indian mobile: 10 digits starting 6–9. Doubles as the member login. */
export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')

export const personSchema = z.object({
  id: idSchema,
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  mobile: mobileSchema,
  address: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(['active', 'inactive']),
  authUserId: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const scheduleLineSchema = z.object({
  monthNumber: z.number().int().positive(),
  dueDate: dateOnlySchema,
  grossPool: paiseSchema,
  plannedPayoutAmount: paiseSchema,
  adjustment: z.number().int().finite(),
})

export const schemeSchema = z.object({
  id: idSchema,
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers and dashes only'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(500).optional(),
  monthlyAmount: paiseSchema.refine((v) => v > 0, 'Monthly contribution is required'),
  maxMembers: z.number().int().min(2, 'At least 2 members').max(500),
  durationMonths: z.number().int().min(1, 'At least 1 month').max(500),
  startDate: dateOnlySchema,
  collectionDay: z.number().int().min(1).max(28),
  profitBps: z.number().int().min(0).max(10_000),
  distributionMode: z.enum(['fixed_profit', 'manual', 'auction', 'custom']),
  scheduleSnapshot: z.array(scheduleLineSchema).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']),
  notes: z.string().trim().max(500).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const schemeMemberSchema = z.object({
  id: idSchema,
  schemeId: idSchema,
  personId: idSchema,
  memberNumber: z.number().int().positive(),
  status: z.enum(['active', 'inactive']),
  joinedAt: dateOnlySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const roundSchema = z.object({
  id: idSchema,
  schemeId: idSchema,
  monthNumber: z.number().int().positive(),
  dueDate: dateOnlySchema,
  expectedCollection: paiseSchema,
  actualCollection: paiseSchema,
  pendingAmount: z.number().int().finite(),
  plannedPayoutAmount: paiseSchema,
  recipientPersonId: idSchema.optional(),
  status: z.enum([
    'upcoming',
    'collection_open',
    'collection_complete',
    'payout_pending',
    'payout_complete',
    'closed',
  ]),
  notes: z.string().trim().max(500).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const paymentSchema = z.object({
  id: idSchema,
  schemeId: idSchema,
  roundId: idSchema,
  personId: idSchema,
  amountDue: paiseSchema,
  amountPaid: paiseSchema,
  paidDate: dateOnlySchema.optional(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
  reference: z.string().trim().max(80).optional(),
  status: z.enum(['pending', 'partially_paid', 'paid', 'waived']),
  notes: z.string().trim().max(500).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const payoutSchema = z.object({
  id: idSchema,
  schemeId: idSchema,
  roundId: idSchema,
  personId: idSchema,
  grossPool: paiseSchema,
  adjustment: z.number().int().finite(),
  payoutAmount: paiseSchema,
  autoCalculated: z.boolean(),
  paidDate: dateOnlySchema.optional(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
  reference: z.string().trim().max(80).optional(),
  status: z.enum(['pending', 'paid']),
  notes: z.string().trim().max(500).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const auditLogSchema = z.object({
  id: idSchema,
  action: z.string().min(1),
  entityType: z.enum([
    'person',
    'scheme',
    'schemeMember',
    'round',
    'payment',
    'payout',
    'settings',
    'backup',
  ]),
  entityId: z.string(),
  summary: z.string(),
  beforeJson: z.string().optional(),
  afterJson: z.string().optional(),
  actorPersonId: idSchema.optional(),
  actorLabel: z.string(),
  createdAt: timestampSchema,
})

export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: timestampSchema,
})

/** Form-level schemas (user input, before ids/timestamps are attached). */
export const personFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  mobile: mobileSchema,
  address: z.string().trim().max(240).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export type PersonFormValues = z.infer<typeof personFormSchema>

export const schemeFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Enter a scheme code')
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only'),
    name: z.string().trim().min(2, 'Enter a scheme name').max(80),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    maxMembers: z.coerce.number<number>().int('Whole numbers only').min(2, 'At least 2 members').max(500),
    monthlyAmountRupees: z.coerce
      .number<number>()
      .positive('Enter the monthly contribution')
      .max(10_000_000),
    durationMonths: z.coerce.number<number>().int('Whole months only').min(1, 'At least 1 month').max(500),
    startDate: dateOnlySchema,
    collectionDay: z.coerce.number<number>().int().min(1, 'Day 1–28').max(28, 'Day 1–28'),
    profitPercent: z.coerce
      .number<number>()
      .min(0, 'Profit cannot be negative')
      .max(100, 'Profit cannot exceed 100%'),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((values) => Number.isFinite(values.monthlyAmountRupees), {
    message: 'Enter a valid amount',
    path: ['monthlyAmountRupees'],
  })

export type SchemeFormValues = z.input<typeof schemeFormSchema>
export type SchemeFormParsed = z.output<typeof schemeFormSchema>
