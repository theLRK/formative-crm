import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { buildApiError } from '@/lib/errors';
import { refreshSchema } from '@/lib/validation';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const fallbackToken = request.cookies.get('refresh_token')?.value;
  const parsed = refreshSchema.safeParse(body ?? { refreshToken: fallbackToken ?? '' });
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid refresh token payload'), {
      status: 400,
    });
  }

  const { sessions } = createRepositories();
  await sessions.deleteByRefreshToken(parsed.data.refreshToken);

  const response = NextResponse.json({
    success: true,
    data: {
      loggedOut: true,
    },
  });
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
