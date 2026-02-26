import { randomUUID } from 'crypto';
import type { DraftStatus, EmailRecord, Lead } from '@/types';

interface LeadsRepositoryLike {
  getById(id: string): Promise<Lead | null>;
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
  ): Promise<Lead>;
}

interface EmailsRepositoryLike {
  getById(id: string): Promise<EmailRecord | null>;
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
  }): Promise<EmailRecord>;
  updateDraftStatus(id: string, status: DraftStatus): Promise<EmailRecord>;
}

interface LogsRepositoryLike {
  create(input: {
    id: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

interface SendReplyInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

interface SendReplyResult {
  messageId: string;
  threadId: string;
}

export interface SendApprovedDraftDependencies {
  repositories: {
    leads: LeadsRepositoryLike;
    emails: EmailsRepositoryLike;
    logs: LogsRepositoryLike;
  };
  sendReply: (input: SendReplyInput) => Promise<SendReplyResult>;
  now?: () => Date;
  generateId?: () => string;
}

export interface SendApprovedDraftInput {
  draftId: string;
  expectedStatus: DraftStatus;
  body: string;
  threadId: string;
}

export class DraftNotFoundError extends Error {
  constructor() {
    super('Draft not found');
    this.name = 'DraftNotFoundError';
  }
}

export class DraftStatusMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftStatusMismatchError';
  }
}

export class ThreadMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThreadMismatchError';
  }
}

export class LeadNotFoundError extends Error {
  constructor() {
    super('Lead not found');
    this.name = 'LeadNotFoundError';
  }
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
    // Logging must not block API flow.
  }
}

export async function sendApprovedDraft(
  input: SendApprovedDraftInput,
  dependencies: SendApprovedDraftDependencies,
): Promise<{
  draftId: string;
  sentMessageId: string;
  threadId: string;
  leadId: string;
  sentAt: string;
}> {
  const { leads, emails, logs } = dependencies.repositories;
  const now = dependencies.now ?? (() => new Date());
  const generateId = dependencies.generateId ?? (() => randomUUID());

  if (input.expectedStatus !== 'PendingApproval') {
    throw new DraftStatusMismatchError('Only PendingApproval drafts can be sent');
  }

  const draft = await emails.getById(input.draftId);
  if (!draft) throw new DraftNotFoundError();
  if (draft.direction !== 'Draft') {
    throw new DraftStatusMismatchError('Email record is not a draft');
  }
  if (draft.draftStatus !== input.expectedStatus) {
    throw new DraftStatusMismatchError(
      `Draft status mismatch. Expected ${input.expectedStatus}, received ${draft.draftStatus ?? 'null'}`,
    );
  }
  if (draft.threadId !== input.threadId) {
    throw new ThreadMismatchError('Draft thread does not match provided thread');
  }

  const lead = await leads.getById(draft.leadId);
  if (!lead) throw new LeadNotFoundError();
  if (!lead.threadId || lead.threadId !== input.threadId) {
    throw new ThreadMismatchError('Lead thread does not match provided thread');
  }

  const response = await dependencies.sendReply({
    to: lead.email,
    subject: draft.subject ?? 'Re: Property inquiry',
    body: input.body,
    threadId: input.threadId,
  });
  if (response.threadId !== input.threadId) {
    await safeLog(logs, 'warn', 'email_thread_conflict', {
      draftId: draft.id,
      leadId: lead.id,
      expectedThreadId: input.threadId,
      actualThreadId: response.threadId,
    });
    throw new ThreadMismatchError('Gmail returned a different thread id');
  }

  const sentAt = now().toISOString();
  await emails.create({
    id: generateId(),
    leadId: lead.id,
    gmailMessageId: response.messageId,
    threadId: response.threadId,
    direction: 'Outbound',
    subject: draft.subject,
    body: input.body,
    sentAt,
  });

  await leads.update(lead.id, {
    lastEmailSentAt: sentAt,
  });
  await emails.updateDraftStatus(draft.id, 'Sent');

  await safeLog(logs, 'info', 'email_outbound_sent', {
    draftId: draft.id,
    leadId: lead.id,
    messageId: response.messageId,
    threadId: response.threadId,
  });

  return {
    draftId: draft.id,
    sentMessageId: response.messageId,
    threadId: response.threadId,
    leadId: lead.id,
    sentAt,
  };
}
