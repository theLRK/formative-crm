import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import { bulkUpdateLeadsSchema } from '@/lib/validation';

interface Failure {
  leadId: string;
  reason: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = bulkUpdateLeadsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid bulk update payload'), {
      status: 400,
    });
  }

  const uniqueLeadIds = [...new Set(parsed.data.leadIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueLeadIds.length === 0) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'No valid lead IDs provided'), {
      status: 400,
    });
  }

  try {
    const { leads } = createRepositories();
    let updatedCount = 0;
    const failures: Failure[] = [];

    for (const leadId of uniqueLeadIds) {
      try {
        const existing = await leads.getById(leadId);
        if (!existing) {
          failures.push({ leadId, reason: 'Lead not found' });
          continue;
        }

        await leads.update(leadId, {
          pipelineStatus: parsed.data.pipelineStatus,
        });
        updatedCount += 1;
      } catch (error) {
        failures.push({
          leadId,
          reason: error instanceof Error ? error.message : 'Unknown update error',
        });
      }
    }

    const failedCount = failures.length;
    return NextResponse.json(
      {
        success: true,
        data: {
          requestedCount: uniqueLeadIds.length,
          updatedCount,
          failedCount,
          pipelineStatus: parsed.data.pipelineStatus,
          failures,
        },
      },
      {
        status: failedCount > 0 ? 207 : 200,
      },
    );
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to bulk update leads'), {
      status: 500,
    });
  }
}
