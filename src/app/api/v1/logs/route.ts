import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';

type LogLevel = 'info' | 'warn' | 'error';

function isLogLevel(value: string): value is LogLevel {
  return value === 'info' || value === 'warn' || value === 'error';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const levelParam = request.nextUrl.searchParams.get('level');
  const limitParam = request.nextUrl.searchParams.get('limit');

  let level: LogLevel | undefined;
  if (levelParam !== null) {
    if (!isLogLevel(levelParam)) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid level query parameter'), {
        status: 400,
      });
    }
    level = levelParam;
  }

  let limit: number | undefined;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
      return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid limit query parameter'), {
        status: 400,
      });
    }
    limit = Math.floor(parsed);
  }

  try {
    const { logs } = createRepositories();
    const entries = await logs.list({ level, limit });
    return NextResponse.json({
      success: true,
      data: {
        count: entries.length,
        logs: entries,
      },
    });
  } catch {
    return NextResponse.json(buildApiError('INTERNAL_ERROR', 'Failed to fetch logs'), {
      status: 500,
    });
  }
}
