export type Tier = 'Hot' | 'Warm' | 'Cold';

export type PipelineStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Question'
  | 'Objection'
  | 'Unqualified'
  | 'Closed';

export type DraftStatus = 'PendingApproval' | 'Sent' | 'NeedsReview';

export type EmailDirection = 'Inbound' | 'Outbound' | 'Draft';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  budget: number | null;
  formScore: number;
  interactionScore: number;
  totalScore: number;
  tier: Tier;
  pipelineStatus: PipelineStatus;
  threadId: string | null;
  lastEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailRecord {
  id: string;
  leadId: string;
  gmailMessageId: string | null;
  threadId: string;
  direction: EmailDirection;
  subject: string | null;
  body: string;
  draftStatus: DraftStatus | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogRecord {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  fullName: string;
  email: string;
  phone?: string | null;
  budget?: number | null;
  formScore: number;
  interactionScore: number;
  totalScore: number;
  tier: Tier;
  pipelineStatus: PipelineStatus;
  threadId?: string | null;
  lastEmailSentAt?: string | null;
}

export interface CreateEmailInput {
  leadId: string;
  gmailMessageId?: string | null;
  threadId: string;
  direction: EmailDirection;
  subject?: string | null;
  body: string;
  draftStatus?: DraftStatus | null;
  sentAt?: string | null;
}

