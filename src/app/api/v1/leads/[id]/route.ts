import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import { updateLeadSchema } from '@/lib/validation';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { leads, emails } = createRepositories();
    const lead = await leads.getById(context.params.id);
    if (!lead) {
      return NextResponse.json(buildApiError('NOT_FOUND', 'Lead not found'), { status: 404 });
    }
    const history = await emails.listByLeadId(lead.id);
    return NextResponse.json({
      success: true,
      data: {
        lead,
        emails: history,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to fetch lead detail'), {
      status: 500,
    });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid lead update payload'), {
      status: 400,
    });
  }

  try {
    const { leads } = createRepositories();
    const existing = await leads.getById(context.params.id);
    if (!existing) {
      return NextResponse.json(buildApiError('NOT_FOUND', 'Lead not found'), { status: 404 });
    }

    const updated = await leads.update(context.params.id, {
      pipelineStatus: parsed.data.pipelineStatus,
    });

    return NextResponse.json({
      success: true,
      data: {
        lead: updated,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to update lead'), {
      status: 500,
    });
  }
}
