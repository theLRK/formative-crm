import { google } from 'googleapis';
import { getEnv } from '@/lib/env';

export interface GmailMessageRef {
  messageId: string;
  threadId: string;
}

export interface SendGmailMessageInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export interface InboundGmailMessage {
  messageId: string;
  threadId: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  receivedAt: Date;
}

function buildOauthClient() {
  const env = getEnv();
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.NEXTAUTH_URL,
  );
  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

function getGmailClient() {
  return google.gmail({
    version: 'v1',
    auth: buildOauthClient(),
  });
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function parseSenderEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function extractBodyText(
  payload?: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: Array<{
      mimeType?: string | null;
      body?: { data?: string | null } | null;
      parts?: unknown;
    }> | null;
  } | null,
): string {
  if (!payload) return '';

  if (payload.body?.data && (!payload.parts || payload.parts.length === 0)) {
    return decodeBase64Url(payload.body.data);
  }

  const parts = payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  for (const part of parts) {
    if (part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  return '';
}

function resolveDate(internalDate: string | null | undefined): Date {
  if (!internalDate) return new Date();
  const timestamp = Number(internalDate);
  if (Number.isNaN(timestamp)) return new Date();
  return new Date(timestamp);
}

function buildRawEmail(input: SendGmailMessageInput): string {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

export async function sendGmailMessage(input: SendGmailMessageInput): Promise<GmailMessageRef> {
  const gmail = getGmailClient();

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: buildRawEmail(input),
      ...(input.threadId ? { threadId: input.threadId } : {}),
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  if (!messageId || !threadId) {
    throw new Error('Gmail API response missing message or thread id');
  }
  return { messageId, threadId };
}

export async function listInboundGmailMessages(after: Date | null): Promise<InboundGmailMessage[]> {
  const gmail = getGmailClient();
  const queryParts = ['in:inbox', '-from:me'];
  if (after) {
    queryParts.push(`after:${Math.floor(after.getTime() / 1000)}`);
  } else {
    queryParts.push('newer_than:30d');
  }

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: queryParts.join(' '),
    maxResults: 50,
    includeSpamTrash: false,
  });

  const refs = listResponse.data.messages ?? [];
  const resolved = await Promise.all(
    refs.map(async (ref) => {
      if (!ref.id) return null;
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: ref.id,
        format: 'full',
      });
      const data = details.data;
      if (!data.id || !data.threadId) return null;

      const headers = data.payload?.headers ?? [];
      const fromHeader = headers.find((header) => header.name?.toLowerCase() === 'from')?.value ?? '';
      const subject = headers.find((header) => header.name?.toLowerCase() === 'subject')?.value ?? null;
      if (!fromHeader) return null;

      return {
        messageId: data.id,
        threadId: data.threadId,
        fromEmail: parseSenderEmail(fromHeader),
        subject,
        body: extractBodyText(data.payload),
        receivedAt: resolveDate(data.internalDate),
      } satisfies InboundGmailMessage;
    }),
  );

  return resolved
    .filter((item): item is InboundGmailMessage => item !== null)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}
