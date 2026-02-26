import { z } from 'zod';

const pipelineStatus = z.enum([
  'New',
  'Contacted',
  'Interested',
  'Question',
  'Objection',
  'Unqualified',
  'Closed',
]);

const draftStatus = z.enum(['PendingApproval', 'Sent', 'NeedsReview']);

export const leadWebhookSchema = z.object({
  idempotencyKey: z.string().min(8),
  fullName: z.string().min(1).max(255),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  phone: z.string().min(5).max(50),
  budget: z.coerce.number().int().positive(),
  purchaseTimeline: z.string().min(1),
  paymentReadiness: z.string().min(1),
  locationPreference: z.string().min(1),
  propertyType: z.string().min(1),
  message: z.string().min(1).max(10000),
});

export const loginSchema = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must include one uppercase letter')
    .regex(/[0-9]/, 'Password must include one number'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const updateLeadSchema = z.object({
  pipelineStatus,
});

export const sendDraftSchema = z.object({
  draftId: z.string().uuid(),
  threadId: z.string().min(5),
  body: z.string().min(1).max(10000),
  expectedStatus: draftStatus.default('PendingApproval'),
});
