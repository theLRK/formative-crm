import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import type { DraftStatus } from '@/types';

const ALLOWED_DRAFT_STATUS: DraftStatus[] = ['PendingApproval', 'Sent', 'NeedsReview'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const statusParam = request.nextUrl.searchParams.get('status');
  const limitParam = request.nextUrl.searchParams.get('limit');

  let status: DraftStatus | undefined;
  if (statusParam) {
    if (!ALLOWED_DRAFT_STATUS.includes(statusParam as DraftStatus)) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid draft status query parameter'), {
        status: 400,
      });
    }
    status = statusParam as DraftStatus;
  }

  let limit: number | undefined;
  if (limitParam !== null) {
    const value = Number(limitParam);
    if (!Number.isFinite(value) || value < 1 || value > 200) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid limit query parameter'), {
        status: 400,
      });
    }
    limit = value;
  }

  try {
    const { emails, leads } = createRepositories();
    const drafts = await emails.listDrafts({
      ...(status ? { status } : {}),
      ...(typeof limit === 'number' ? { limit } : {}),
    });

    const items = await Promise.all(
      drafts.map(async (draft) => {
        const lead = await leads.getById(draft.leadId);
        return {
          draft,
          lead: lead
            ? {
                id: lead.id,
                fullName: lead.fullName,
                email: lead.email,
                tier: lead.tier,
                pipelineStatus: lead.pipelineStatus,
              }
            : null,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        count: items.length,
        items,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to fetch drafts'), {
      status: 500,
    });
  }
}
