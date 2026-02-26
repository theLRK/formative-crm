import { randomUUID } from 'crypto';
import { computeInteractionScore, computeTier, computeTotalScore, computeIntentScore } from '@/lib/scoring';
import type { DraftStatus, PipelineStatus, Tier } from '@/types';

export interface InboundMessage {
  messageId: string;
  threadId: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  receivedAt: Date;
}

interface LeadLike {
  id: string;
  email: string;
  fullName: string;
  formScore: number;
  interactionScore: number;
  totalScore: number;
  tier: Tier;
  pipelineStatus: PipelineStatus;
  threadId: string | null;
  lastEmailSentAt: string | null;
}

interface LeadsRepositoryLike {
  findByEmail(email: string): Promise<LeadLike | null>;
  update(
    id: string,
    patch: Partial<{
      interactionScore: number;
      totalScore: number;
      tier: Tier;
      pipelineStatus: PipelineStatus;
      threadId: string | null;
      lastEmailSentAt: string | null;
    }>,
  ): Promise<unknown>;
}

interface EmailsRepositoryLike {
  findByMessageId(messageId: string): Promise<{ id: string } | null>;
  countInboundByLeadAndThread(leadId: string, threadId: string): Promise<number>;
  create(input: {
    id: string;
    leadId: string;
    gmailMessageId?: string | null;
    threadId: string;
    direction: 'Inbound' | 'Outbound' | 'Draft';
    subject?: string | null;
    body: string;
    draftStatus?: DraftStatus | null;
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

export interface ProcessEmailPollDependencies {
  repositories: {
    leads: LeadsRepositoryLike;
    emails: EmailsRepositoryLike;
    logs: LogsRepositoryLike;
  };
  fetchInboundMessages: (after: Date | null) => Promise<InboundMessage[]>;
  generateDraft: (prompt: string) => Promise<string>;
  after?: Date | null;
  now?: () => Date;
  generateId?: () => string;
}

export interface ProcessEmailPollResult {
  fetched: number;
  processed: number;
  duplicates: number;
  unmatched: number;
  threadConflicts: number;
  emptyIgnored: number;
  draftsPendingApproval: number;
  draftsNeedsReview: number;
}

const OBJECTION_KEYWORDS = [
  'too expensive',
  'price is high',
  'price too high',
  'not sure',
  'concern',
  'objection',
];
const UNQUALIFIED_KEYWORDS = [
  'not interested',
  'cannot afford',
  "can't afford",
  'outside budget',
  'stop contacting',
  'not proceeding',
];
const QUESTION_KEYWORDS = ['how', 'what', 'when', 'where', 'which', 'can you', 'could you'];

function normalize(input: string): string {
  return input.toLowerCase().trim();
}

export function cleanInboundBody(body: string): string {
  if (!body) return '';
  const lines = body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  const filtered: string[] = [];
  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) {
      filtered.push('');
      continue;
    }
    if (/^>/.test(normalized)) break;
    if (/^on .*wrote:$/i.test(normalized)) break;
    if (/^from:\s/i.test(normalized)) break;
    if (/^sent from my/i.test(normalized)) break;
    if (normalized === '--') break;
    filtered.push(line);
  }
  return filtered.join('\n').trim();
}

function derivePipelineStatus(messageBody: string, currentStatus: PipelineStatus): PipelineStatus {
  const content = normalize(messageBody);
  if (!content) return currentStatus;
  if (UNQUALIFIED_KEYWORDS.some((keyword) => content.includes(keyword))) return 'Unqualified';
  if (OBJECTION_KEYWORDS.some((keyword) => content.includes(keyword))) return 'Objection';
  if (computeIntentScore(content) >= 25) return 'Interested';
  if (content.includes('?') || QUESTION_KEYWORDS.some((keyword) => content.includes(keyword))) return 'Question';
  return currentStatus;
}

function buildDraftPrompt(input: {
  leadName: string;
  leadTier: Tier;
  leadStatus: PipelineStatus;
  buyerMessage: string;
}): string {
  return [
    'You are assisting a premium real-estate agent in Lekki and Victoria Island.',
    'Write a concise and professional email reply.',
    'Constraints:',
    '- Keep under 180 words.',
    '- Confirm understanding of buyer message.',
    '- Suggest next actionable step (viewing schedule or question response).',
    '- Keep tone polite, direct, and sales-professional.',
    '',
    `Lead Name: ${input.leadName}`,
    `Lead Tier: ${input.leadTier}`,
    `Pipeline Status: ${input.leadStatus}`,
    `Buyer Message: ${input.buyerMessage}`,
  ].join('\n');
}

function fallbackDraft(message: string): string {
  return [
    'Thank you for your reply.',
    '',
    'I have reviewed your message and will get back with the most relevant options and next steps shortly.',
    '',
    `Internal note: ${message}`,
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
    // Non-blocking logging.
  }
}

export async function processInboundEmailPoll(
  dependencies: ProcessEmailPollDependencies,
): Promise<ProcessEmailPollResult> {
  const after = dependencies.after ?? null;
  const now = dependencies.now ?? (() => new Date());
  const generateId = dependencies.generateId ?? (() => randomUUID());
  const { leads, emails, logs } = dependencies.repositories;
  const counters: ProcessEmailPollResult = {
    fetched: 0,
    processed: 0,
    duplicates: 0,
    unmatched: 0,
    threadConflicts: 0,
    emptyIgnored: 0,
    draftsPendingApproval: 0,
    draftsNeedsReview: 0,
  };

  const messages = await dependencies.fetchInboundMessages(after);
  const ordered = [...messages].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  counters.fetched = ordered.length;

  for (const message of ordered) {
    const duplicate = await emails.findByMessageId(message.messageId);
    if (duplicate) {
      counters.duplicates += 1;
      continue;
    }

    const lead = await leads.findByEmail(message.fromEmail.toLowerCase());
    if (!lead) {
      counters.unmatched += 1;
      await safeLog(logs, 'warn', 'email_unmatched', {
        messageId: message.messageId,
        threadId: message.threadId,
        fromEmail: message.fromEmail,
      });
      continue;
    }

    const cleanedBody = cleanInboundBody(message.body);
    if (!cleanedBody) {
      counters.emptyIgnored += 1;
      await safeLog(logs, 'info', 'email_empty_ignored', {
        leadId: lead.id,
        messageId: message.messageId,
      });
      await emails.create({
        id: generateId(),
        leadId: lead.id,
        gmailMessageId: message.messageId,
        threadId: message.threadId,
        direction: 'Inbound',
        subject: message.subject,
        body: '',
        sentAt: message.receivedAt.toISOString(),
      });
      continue;
    }

    await emails.create({
      id: generateId(),
      leadId: lead.id,
      gmailMessageId: message.messageId,
      threadId: message.threadId,
      direction: 'Inbound',
      subject: message.subject,
      body: cleanedBody,
      sentAt: message.receivedAt.toISOString(),
    });

    if (!lead.threadId || lead.threadId !== message.threadId) {
      counters.threadConflicts += 1;
      await safeLog(logs, 'warn', 'email_thread_conflict', {
        leadId: lead.id,
        messageId: message.messageId,
        expectedThreadId: lead.threadId,
        actualThreadId: message.threadId,
      });
      continue;
    }

    const existingReplies = await emails.countInboundByLeadAndThread(lead.id, message.threadId);
    const interactionScore = computeInteractionScore({
      lastEmailSentAt: lead.lastEmailSentAt ? new Date(lead.lastEmailSentAt) : null,
      replyReceivedAt: message.receivedAt,
      messageBody: cleanedBody,
      replyCountInThread: existingReplies,
    });
    const totalScore = computeTotalScore(lead.formScore, interactionScore);
    const tier = computeTier(totalScore);
    const pipelineStatus = derivePipelineStatus(cleanedBody, lead.pipelineStatus);

    await leads.update(lead.id, {
      interactionScore,
      totalScore,
      tier,
      pipelineStatus,
    });

    let draftStatus: DraftStatus = 'PendingApproval';
    let draftBody = '';
    try {
      draftBody = await dependencies.generateDraft(
        buildDraftPrompt({
          leadName: lead.fullName,
          leadTier: tier,
          leadStatus: pipelineStatus,
          buyerMessage: cleanedBody,
        }),
      );
    } catch (error) {
      draftStatus = 'NeedsReview';
      draftBody = fallbackDraft(error instanceof Error ? error.message : 'AI draft generation failed');
    }

    await emails.create({
      id: generateId(),
      leadId: lead.id,
      threadId: message.threadId,
      direction: 'Draft',
      subject: message.subject ? `Re: ${message.subject}` : 'Re: Property inquiry',
      body: draftBody,
      draftStatus,
    });

    counters.processed += 1;
    if (draftStatus === 'PendingApproval') counters.draftsPendingApproval += 1;
    if (draftStatus === 'NeedsReview') counters.draftsNeedsReview += 1;

    await safeLog(logs, 'info', 'email_inbound_processed', {
      leadId: lead.id,
      messageId: message.messageId,
      interactionScore,
      totalScore,
      tier,
      pipelineStatus,
      processedAt: now().toISOString(),
    });
  }

  return counters;
}
