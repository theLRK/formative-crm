import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { getEnv } from '@/lib/env';
import { buildApiError } from '@/lib/errors';
import { sendGmailMessage } from '@/lib/gmail';
import {
  DuplicateLeadError,
  hasProcessedIdempotencyKey,
  markIdempotencyKeyProcessed,
  processLeadWebhook,
  InitialEmailSendError,
  normalizeLeadWebhookPayload,
} from '@/lib/leads';
import { leadWebhookSchema } from '@/lib/validation';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawPayload = await request.json().catch(() => null);
  const headerIdempotencyKey = request.headers.get('x-idempotency-key') ?? undefined;
  const payloadWithIdempotency = normalizeLeadWebhookPayload(rawPayload, {
    headerIdempotencyKey,
  });

  const parsed = leadWebhookSchema.safeParse(payloadWithIdempotency);
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid webhook payload'), {
      status: 400,
    });
  }

  if (hasProcessedIdempotencyKey(parsed.data.idempotencyKey)) {
    return NextResponse.json({
      success: true,
      data: {
        idempotent: true,
        message: 'Duplicate submission ignored by idempotency key',
      },
    });
  }

  try {
    const env = getEnv();
    const repositories = createRepositories();
    const result = await processLeadWebhook(parsed.data, {
      repositories,
      sendInitialEmail: sendGmailMessage,
      scoringConfig: {
        premiumBudgetThreshold: env.PREMIUM_BUDGET_THRESHOLD,
      },
    });
    markIdempotencyKeyProcessed(parsed.data.idempotencyKey);

    return NextResponse.json(
      {
        success: true,
        data: {
          idempotent: false,
          leadId: result.leadId,
          messageId: result.messageId,
          threadId: result.threadId,
          scores: {
            formScore: result.formScore,
            interactionScore: result.interactionScore,
            totalScore: result.totalScore,
            tier: result.tier,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DuplicateLeadError) {
      return NextResponse.json(
        buildApiError('VALIDATION_ERROR', 'Lead with this email already exists'),
        { status: 409 },
      );
    }
    if (error instanceof InitialEmailSendError) {
      return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Lead created but initial email failed'), {
        status: 502,
      });
    }
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to process webhook'), {
      status: 500,
    });
  }
}
