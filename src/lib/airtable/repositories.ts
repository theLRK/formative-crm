import type {
  CreateEmailInput,
  CreateLeadInput,
  DraftStatus,
  EmailRecord,
  Lead,
  LogRecord,
  PipelineStatus,
  Session,
  Tier,
  User,
} from '@/types';
import { AirtableClient } from './client';

function nowIso(): string {
  return new Date().toISOString();
}

function escFormula(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

type UserFields = {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SessionFields = {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type LeadFields = {
  id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  budget?: number;
  form_score?: number;
  interaction_score?: number;
  total_score?: number;
  tier?: Tier;
  pipeline_status?: PipelineStatus;
  thread_id?: string;
  last_email_sent_at?: string;
  created_at?: string;
  updated_at?: string;
  // Legacy fields from pre-contract Airtable schema.
  'Lead Name'?: string;
  'Full Name'?: string;
  'Email'?: string;
  'Phone'?: string;
  'Budget'?: number;
  'Status'?: string;
  'Date Created'?: string;
};

type EmailFields = {
  id: string;
  lead_id: string;
  gmail_message_id?: string;
  thread_id: string;
  direction: 'Inbound' | 'Outbound' | 'Draft';
  subject?: string;
  body: string;
  draft_status?: DraftStatus;
  sent_at?: string;
  created_at: string;
  updated_at: string;
};

type LogFields = {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
};

function mapUser(fields: UserFields): User {
  return {
    id: fields.id,
    email: fields.email,
    passwordHash: fields.password_hash,
    role: fields.role,
    isActive: fields.is_active,
    createdAt: fields.created_at,
    updatedAt: fields.updated_at,
  };
}

function mapSession(fields: SessionFields): Session {
  return {
    id: fields.id,
    userId: fields.user_id,
    refreshToken: fields.refresh_token,
    expiresAt: fields.expires_at,
    createdAt: fields.created_at,
    updatedAt: fields.updated_at,
  };
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeTier(value: unknown): Tier {
  if (value === 'Hot' || value === 'Warm' || value === 'Cold') return value;
  return 'Cold';
}

function normalizePipelineStatus(value: unknown): PipelineStatus {
  if (
    value === 'New' ||
    value === 'Contacted' ||
    value === 'Interested' ||
    value === 'Question' ||
    value === 'Objection' ||
    value === 'Unqualified' ||
    value === 'Closed'
  ) {
    return value;
  }
  return 'New';
}

function normalizeDateString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

function mapLead(fields: LeadFields, airtableRecordId: string, createdTime: string): Lead {
  const fullName = fields.full_name ?? fields['Full Name'] ?? fields['Lead Name'] ?? 'Unnamed Lead';
  const email = fields.email ?? fields.Email ?? '';
  const phone = fields.phone ?? fields.Phone ?? null;
  const budget = safeNumber(fields.budget ?? fields.Budget, 0);
  const formScore = safeNumber(fields.form_score, 0);
  const interactionScore = safeNumber(fields.interaction_score, 0);
  const totalScore = safeNumber(fields.total_score, 0);
  const tier = normalizeTier(fields.tier);
  const pipelineStatus = normalizePipelineStatus(fields.pipeline_status ?? fields.Status);
  const createdAt = normalizeDateString(fields.created_at ?? fields['Date Created'], createdTime);
  const updatedAt = normalizeDateString(fields.updated_at, createdAt);

  return {
    id: fields.id ?? airtableRecordId,
    fullName,
    email,
    phone,
    budget,
    formScore,
    interactionScore,
    totalScore,
    tier,
    pipelineStatus,
    threadId: fields.thread_id ?? null,
    lastEmailSentAt: fields.last_email_sent_at ?? null,
    createdAt,
    updatedAt,
  };
}

function mapEmail(fields: EmailFields): EmailRecord {
  return {
    id: fields.id,
    leadId: fields.lead_id,
    gmailMessageId: fields.gmail_message_id ?? null,
    threadId: fields.thread_id,
    direction: fields.direction,
    subject: fields.subject ?? null,
    body: fields.body,
    draftStatus: fields.draft_status ?? null,
    sentAt: fields.sent_at ?? null,
    createdAt: fields.created_at,
    updatedAt: fields.updated_at,
  };
}

function parseLogMetadata(input: unknown): Record<string, unknown> | null {
  if (!input) return null;
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { raw: input };
    } catch {
      return { raw: input };
    }
  }
  return null;
}

function mapLog(fields: LogFields): LogRecord {
  return {
    id: fields.id,
    level: fields.level,
    message: fields.message,
    metadata: parseLogMetadata(fields.metadata),
    createdAt: fields.created_at,
    updatedAt: fields.updated_at,
  };
}

export class UsersRepository {
  constructor(private readonly client: AirtableClient) {}

  async findById(id: string): Promise<User | null> {
    const records = await this.client.listRecords<UserFields>('users', {
      filterByFormula: `{id}="${escFormula(id)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapUser(records[0].fields) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const records = await this.client.listRecords<UserFields>('users', {
      filterByFormula: `{email}="${escFormula(email)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapUser(records[0].fields) : null;
  }

  async create(input: { id: string; email: string; passwordHash: string }): Promise<User> {
    const timestamp = nowIso();
    const record = await this.client.createRecord<UserFields>('users', {
      id: input.id,
      email: input.email,
      password_hash: input.passwordHash,
      role: 'admin',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return mapUser(record.fields);
  }
}

export class SessionsRepository {
  constructor(private readonly client: AirtableClient) {}

  async create(input: { id: string; userId: string; refreshToken: string; expiresAt: string }): Promise<Session> {
    const timestamp = nowIso();
    const record = await this.client.createRecord<SessionFields>('sessions', {
      id: input.id,
      user_id: input.userId,
      refresh_token: input.refreshToken,
      expires_at: input.expiresAt,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return mapSession(record.fields);
  }

  async deleteByRefreshToken(refreshToken: string): Promise<void> {
    const records = await this.client.listRecords<SessionFields>('sessions', {
      filterByFormula: `{refresh_token}="${escFormula(refreshToken)}"`,
      maxRecords: 1,
    });
    if (records[0]) {
      await this.client.deleteRecord('sessions', records[0].id);
    }
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    const records = await this.client.listRecords<SessionFields>('sessions', {
      filterByFormula: `{refresh_token}="${escFormula(refreshToken)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapSession(records[0].fields) : null;
  }
}

export class LeadsRepository {
  constructor(private readonly client: AirtableClient) {}

  async findByEmail(email: string): Promise<Lead | null> {
    const records = await this.client.listRecords<LeadFields>('leads', {
      filterByFormula: `{email}="${escFormula(email)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapLead(records[0].fields, records[0].id, records[0].createdTime) : null;
  }

  async create(input: CreateLeadInput & { id: string }): Promise<Lead> {
    const timestamp = nowIso();
    const record = await this.client.createRecord<LeadFields>('leads', {
      id: input.id,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone ?? undefined,
      budget: input.budget ?? undefined,
      form_score: input.formScore,
      interaction_score: input.interactionScore,
      total_score: input.totalScore,
      tier: input.tier,
      pipeline_status: input.pipelineStatus,
      thread_id: input.threadId ?? undefined,
      last_email_sent_at: input.lastEmailSentAt ?? undefined,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return mapLead(record.fields, record.id, record.createdTime);
  }

  async list(params?: { status?: PipelineStatus; minScore?: number }): Promise<Lead[]> {
    let filter: string | undefined;
    if (params?.status && typeof params.minScore === 'number') {
      filter = `AND({pipeline_status}="${escFormula(params.status)}",{total_score}>=${params.minScore})`;
    } else if (params?.status) {
      filter = `{pipeline_status}="${escFormula(params.status)}"`;
    } else if (typeof params?.minScore === 'number') {
      filter = `{total_score}>=${params.minScore}`;
    }

    const records = await this.client.listRecords<LeadFields>('leads', {
      filterByFormula: filter,
      sortField: 'updated_at',
      sortDirection: 'desc',
      pageSize: 100,
    });
    return records.map((record) => mapLead(record.fields, record.id, record.createdTime));
  }

  async getById(id: string): Promise<Lead | null> {
    const records = await this.client.listRecords<LeadFields>('leads', {
      filterByFormula: `OR({id}="${escFormula(id)}",RECORD_ID()="${escFormula(id)}")`,
      maxRecords: 1,
    });
    return records[0] ? mapLead(records[0].fields, records[0].id, records[0].createdTime) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      interactionScore: number;
      totalScore: number;
      tier: Tier;
      pipelineStatus: PipelineStatus;
      threadId: string | null;
      lastEmailSentAt: string | null;
    }>,
  ): Promise<Lead> {
    const fields: Partial<LeadFields> = {
      updated_at: nowIso(),
    };

    if (typeof patch.interactionScore === 'number') fields.interaction_score = patch.interactionScore;
    if (typeof patch.totalScore === 'number') fields.total_score = patch.totalScore;
    if (patch.tier) fields.tier = patch.tier;
    if (patch.pipelineStatus) fields.pipeline_status = patch.pipelineStatus;
    if (patch.threadId !== undefined) fields.thread_id = patch.threadId ?? undefined;
    if (patch.lastEmailSentAt !== undefined) fields.last_email_sent_at = patch.lastEmailSentAt ?? undefined;

    const records = await this.client.listRecords<LeadFields>('leads', {
      filterByFormula: `OR({id}="${escFormula(id)}",RECORD_ID()="${escFormula(id)}")`,
      maxRecords: 1,
    });
    if (!records[0]) throw new Error(`Lead not found: ${id}`);
    const updated = await this.client.updateRecord<LeadFields>('leads', records[0].id, fields);
    return mapLead(updated.fields, updated.id, updated.createdTime);
  }
}

export class EmailsRepository {
  constructor(private readonly client: AirtableClient) {}

  async findByMessageId(messageId: string): Promise<EmailRecord | null> {
    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula: `{gmail_message_id}="${escFormula(messageId)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapEmail(records[0].fields) : null;
  }

  async create(input: CreateEmailInput & { id: string }): Promise<EmailRecord> {
    const timestamp = nowIso();
    const record = await this.client.createRecord<EmailFields>('emails', {
      id: input.id,
      lead_id: input.leadId,
      gmail_message_id: input.gmailMessageId ?? undefined,
      thread_id: input.threadId,
      direction: input.direction,
      subject: input.subject ?? undefined,
      body: input.body,
      draft_status: input.draftStatus ?? undefined,
      sent_at: input.sentAt ?? undefined,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return mapEmail(record.fields);
  }

  async listByLeadId(leadId: string): Promise<EmailRecord[]> {
    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula: `{lead_id}="${escFormula(leadId)}"`,
      sortField: 'created_at',
      sortDirection: 'asc',
      pageSize: 100,
    });
    return records.map((record) => mapEmail(record.fields));
  }

  async listDrafts(params?: { status?: DraftStatus; limit?: number }): Promise<EmailRecord[]> {
    const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));
    const formulaParts = ['{direction}="Draft"'];
    if (params?.status) {
      formulaParts.push(`{draft_status}="${escFormula(params.status)}"`);
    }

    const filterByFormula =
      formulaParts.length > 1 ? `AND(${formulaParts.join(',')})` : formulaParts[0];

    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula,
      sortField: 'updated_at',
      sortDirection: 'desc',
      maxRecords: limit,
    });
    return records.map((record) => mapEmail(record.fields));
  }

  async countInboundByLeadAndThread(leadId: string, threadId: string): Promise<number> {
    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula: `AND({lead_id}="${escFormula(leadId)}",{thread_id}="${escFormula(threadId)}",{direction}="Inbound")`,
      pageSize: 100,
    });
    return records.length;
  }

  async getById(id: string): Promise<EmailRecord | null> {
    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula: `{id}="${escFormula(id)}"`,
      maxRecords: 1,
    });
    return records[0] ? mapEmail(records[0].fields) : null;
  }

  async updateDraftStatus(id: string, status: DraftStatus): Promise<EmailRecord> {
    const records = await this.client.listRecords<EmailFields>('emails', {
      filterByFormula: `{id}="${escFormula(id)}"`,
      maxRecords: 1,
    });
    if (!records[0]) throw new Error(`Email not found: ${id}`);
    const updated = await this.client.updateRecord<EmailFields>('emails', records[0].id, {
      draft_status: status,
      updated_at: nowIso(),
      ...(status === 'Sent' ? { sent_at: nowIso() } : {}),
    });
    return mapEmail(updated.fields);
  }
}

export class LogsRepository {
  constructor(private readonly client: AirtableClient) {}

  async create(input: { id: string; level: 'info' | 'warn' | 'error'; message: string; metadata?: Record<string, unknown> }): Promise<LogRecord> {
    const timestamp = nowIso();
    const record = await this.client.createRecord<LogFields>('logs', {
      id: input.id,
      level: input.level,
      message: input.message,
      metadata: input.metadata,
      created_at: timestamp,
      updated_at: timestamp,
    });
    return mapLog(record.fields);
  }

  async findLatestByMessage(message: string): Promise<LogRecord | null> {
    const records = await this.client.listRecords<LogFields>('logs', {
      filterByFormula: `{message}="${escFormula(message)}"`,
      sortField: 'created_at',
      sortDirection: 'desc',
      maxRecords: 1,
    });
    return records[0] ? mapLog(records[0].fields) : null;
  }

  async list(params?: { level?: 'info' | 'warn' | 'error'; limit?: number }): Promise<LogRecord[]> {
    const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));
    const records = await this.client.listRecords<LogFields>('logs', {
      filterByFormula: params?.level ? `{level}="${escFormula(params.level)}"` : undefined,
      sortField: 'created_at',
      sortDirection: 'desc',
      maxRecords: limit,
    });
    return records.map((record) => mapLog(record.fields));
  }
}
