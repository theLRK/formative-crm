import { randomUUID } from 'crypto';
import { assertNoDuplicateLeadByEmail } from '@/lib/leads/duplicate-check';
import {
  computeFormScore,
  computeTier,
  computeTotalScore,
  normalizeScoringConfig,
  type ScoringConfig,
} from '@/lib/scoring';
import { executeWithRetry } from '@/lib/utils/retry';
import { leadWebhookSchema } from '@/lib/validation';
import type { z } from 'zod';
import {
  mapLocationPreference,
  mapPaymentReadiness,
  mapPropertyTypeSpecificity,
  mapPurchaseTimeline,
} from './webhook-mapping';

type LeadWebhookInput = z.infer<typeof leadWebhookSchema>;

interface LeadsRepositoryLike {
  findByEmail(email: string): Promise<{ id: string } | null>;
  create(input: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    budget?: number | null;
    formScore: number;
    interactionScore: number;
    totalScore: number;
    tier: 'Hot' | 'Warm' | 'Cold';
    pipelineStatus: 'New' | 'Contacted' | 'Interested' | 'Question' | 'Objection' | 'Unqualified' | 'Closed';
    threadId?: string | null;
    lastEmailSentAt?: string | null;
  }): Promise<{ id: string }>;
  update(
    id: string,
    patch: Partial<{
      interactionScore: number;
      totalScore: number;
      tier: 'Hot' | 'Warm' | 'Cold';
      pipelineStatus: 'New' | 'Contacted' | 'Interested' | 'Question' | 'Objection' | 'Unqualified' | 'Closed';
      threadId: string | null;
      lastEmailSentAt: string | null;
    }>,
  ): Promise<unknown>;
}

interface EmailsRepositoryLike {
  create(input: {
    id: string;
    leadId: string;
    gmailMessageId?: string | null;
    threadId: string;
    direction: 'Inbound' | 'Outbound' | 'Draft';
    subject?: string | null;
    body: string;
    draftStatus?: 'PendingApproval' | 'Sent' | 'NeedsReview' | null;
    sentAt?: string | null;
  }): Promise<unknown>;
}

interface LogsRepositoryLike {
  create(input: {
    id: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

interface SendInitialEmailInput {
  to: string;
  subject: string;
  body: string;
}

interface SendInitialEmailResult {
  messageId: string;
  threadId: string;
}

interface ProcessLeadWebhookDependencies {
  repositories: {
    leads: LeadsRepositoryLike;
    emails: EmailsRepositoryLike;
    logs: LogsRepositoryLike;
  };
  scoringConfig: {
    premiumBudgetThreshold: number;
    midTierBudgetThreshold?: number;
    entryTierBudgetThreshold?: number;
  };
  sendInitialEmail: (input: SendInitialEmailInput) => Promise<SendInitialEmailResult>;
  now?: () => Date;
  generateId?: () => string;
}

export class InitialEmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitialEmailSendError';
  }
}

function buildInitialEmailBody(payload: LeadWebhookInput): string {
  return [
    `Hi ${payload.fullName},`,
    '',
    'Thanks for your property interest. Based on your preferences, I can share curated options in Lekki and Victoria Island.',
    '',
    `Your preference summary:`,
    `- Budget: ${payload.budget}`,
    `- Timeline: ${payload.purchaseTimeline}`,
    `- Payment: ${payload.paymentReadiness}`,
    `- Location: ${payload.locationPreference}`,
    `- Property Type: ${payload.propertyType}`,
    '',
    payload.message,
    '',
    'Reply to this email with your preferred viewing day and time.',
  ].join('\n');
}

async function safeLog(
  logs: LogsRepositoryLike,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await logs.create({
      id: randomUUID(),
      level,
      message,
      metadata,
    });
  } catch {
    // Non-blocking log fallback.
  }
}

export async function processLeadWebhook(
  payload: LeadWebhookInput,
  dependencies: ProcessLeadWebhookDependencies,
): Promise<{
  leadId: string;
  formScore: number;
  interactionScore: number;
  totalScore: number;
  tier: 'Hot' | 'Warm' | 'Cold';
  messageId: string;
  threadId: string;
}> {
  const { repositories, sendInitialEmail } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const generateId = dependencies.generateId ?? (() => randomUUID());
  const scoringConfig: ScoringConfig = normalizeScoringConfig({
    premiumBudgetThreshold: dependencies.scoringConfig.premiumBudgetThreshold,
    midTierBudgetThreshold: dependencies.scoringConfig.midTierBudgetThreshold,
    entryTierBudgetThreshold: dependencies.scoringConfig.entryTierBudgetThreshold,
  });

  await safeLog(repositories.logs, 'info', 'lead_webhook_received', {
    email: payload.email,
    idempotencyKey: payload.idempotencyKey,
  });

  await assertNoDuplicateLeadByEmail(dependencies.repositories.leads as never, payload.email);

  const formScore = computeFormScore(
    {
      budget: payload.budget ?? null,
      purchaseTimeline: mapPurchaseTimeline(payload.purchaseTimeline),
      paymentReadiness: mapPaymentReadiness(payload.paymentReadiness),
      locationMatch: mapLocationPreference(payload.locationPreference),
      propertyTypeSpecificity: mapPropertyTypeSpecificity(payload.propertyType),
    },
    scoringConfig,
  );
  const interactionScore = 0;
  const totalScore = computeTotalScore(formScore, interactionScore);
  const tier = computeTier(totalScore);

  await safeLog(repositories.logs, 'info', 'lead_scored', {
    email: payload.email,
    formScore,
    interactionScore,
    totalScore,
    tier,
  });

  const leadId = generateId();
  await executeWithRetry(
    () =>
      repositories.leads.create({
        id: leadId,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone ?? null,
        budget: payload.budget ?? null,
        formScore,
        interactionScore,
        totalScore,
        tier,
        pipelineStatus: 'New',
      }),
    {
      attempts: 3,
      delayMs: 250,
    },
  );

  await safeLog(repositories.logs, 'info', 'lead_created', {
    leadId,
    email: payload.email,
  });

  const subject = 'Curated Property Options for You';
  const body = buildInitialEmailBody(payload);
  let sendResult: SendInitialEmailResult;

  try {
    sendResult = await executeWithRetry(() => sendInitialEmail({ to: payload.email, subject, body }), {
      attempts: 2,
      delayMs: 500,
      onRetry: (error, attempt) => {
        void safeLog(repositories.logs, 'warn', 'initial_email_retry', {
          leadId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  } catch (error) {
    await safeLog(repositories.logs, 'error', 'email_send_failed', {
      leadId,
      email: payload.email,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new InitialEmailSendError('Failed to send initial email');
  }

  const sentAt = now().toISOString();
  await executeWithRetry(
    () =>
      repositories.emails.create({
        id: generateId(),
        leadId,
        gmailMessageId: sendResult.messageId,
        threadId: sendResult.threadId,
        direction: 'Outbound',
        subject,
        body,
        sentAt,
      }),
    {
      attempts: 3,
      delayMs: 250,
    },
  );

  await executeWithRetry(
    () =>
      repositories.leads.update(leadId, {
        pipelineStatus: 'Contacted',
        threadId: sendResult.threadId,
        lastEmailSentAt: sentAt,
      }),
    {
      attempts: 3,
      delayMs: 250,
    },
  );

  await safeLog(repositories.logs, 'info', 'email_outbound_sent', {
    leadId,
    messageId: sendResult.messageId,
    threadId: sendResult.threadId,
  });

  return {
    leadId,
    formScore,
    interactionScore,
    totalScore,
    tier,
    messageId: sendResult.messageId,
    threadId: sendResult.threadId,
  };
}
