import { NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { generateDraftReply } from '@/lib/ai';
import { buildApiError } from '@/lib/errors';
import { listInboundGmailMessages } from '@/lib/gmail';
import { processInboundEmailPoll } from '@/lib/emails';

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function POST(): Promise<NextResponse> {
  try {
    const repositories = createRepositories();
    const latestPollLog = await repositories.logs.findLatestByMessage('email_poll_completed');
    const afterCursor =
      toDate(latestPollLog?.metadata?.pollCompletedAt) ?? toDate(latestPollLog?.createdAt) ?? null;

    const summary = await processInboundEmailPoll({
      repositories,
      after: afterCursor,
      fetchInboundMessages: listInboundGmailMessages,
      generateDraft: generateDraftReply,
    });

    const pollCompletedAt = new Date().toISOString();
    await repositories.logs.create({
      id: crypto.randomUUID(),
      level: 'info',
      message: 'email_poll_completed',
      metadata: {
        ...summary,
        pollCompletedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        afterCursor: afterCursor?.toISOString() ?? null,
        pollCompletedAt,
        summary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      buildApiError(
        'INTERNAL_ERROR',
        `Failed to run email poll: ${error instanceof Error ? error.message : 'unknown error'}`,
      ),
      { status: 500 },
    );
  }
}
