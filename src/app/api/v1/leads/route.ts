import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import type { PipelineStatus } from '@/types';

const ALLOWED_PIPELINE_STATUS: PipelineStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Question',
  'Objection',
  'Unqualified',
  'Closed',
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const statusParam = request.nextUrl.searchParams.get('status');
  const minScoreParam = request.nextUrl.searchParams.get('minScore');

  let status: PipelineStatus | undefined;
  if (statusParam) {
    if (!ALLOWED_PIPELINE_STATUS.includes(statusParam as PipelineStatus)) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid status query parameter'), {
        status: 400,
      });
    }
    status = statusParam as PipelineStatus;
  }

  let minScore: number | undefined;
  if (minScoreParam !== null) {
    const value = Number(minScoreParam);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid minScore query parameter'), {
        status: 400,
      });
    }
    minScore = value;
  }

  try {
    const { leads } = createRepositories();
    const records = await leads.list({
      ...(status ? { status } : {}),
      ...(typeof minScore === 'number' ? { minScore } : {}),
    });
    return NextResponse.json({
      success: true,
      data: {
        count: records.length,
        leads: records,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to fetch leads'), {
      status: 500,
    });
  }
}
