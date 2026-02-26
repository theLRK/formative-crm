import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { sendApprovedDraft, DraftNotFoundError, DraftStatusMismatchError, ThreadMismatchError, LeadNotFoundError } from '@/lib/emails';
import { buildApiError } from '@/lib/errors';
import { sendGmailMessage } from '@/lib/gmail';
import { sendDraftSchema } from '@/lib/validation';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const payload = await request.json().catch(() => null);
  const parsed = sendDraftSchema.safeParse({
    ...(payload ?? {}),
    draftId: payload?.draftId ?? context.params.id,
  });
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid draft send payload'), {
      status: 400,
    });
  }

  try {
    const repositories = createRepositories();
    const result = await sendApprovedDraft(parsed.data, {
      repositories,
      sendReply: sendGmailMessage,
    });

    return NextResponse.json({
      success: true,
      data: {
        draftId: result.draftId,
        leadId: result.leadId,
        threadId: result.threadId,
        messageId: result.sentMessageId,
        sentAt: result.sentAt,
      },
    });
  } catch (error) {
    if (error instanceof DraftNotFoundError || error instanceof LeadNotFoundError) {
      return NextResponse.json(buildApiError('NOT_FOUND', error.message), { status: 404 });
    }
    if (error instanceof DraftStatusMismatchError) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', error.message), { status: 409 });
    }
    if (error instanceof ThreadMismatchError) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', error.message), { status: 409 });
    }
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to send approved draft'), {
      status: 500,
    });
  }
}
