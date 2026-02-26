import { randomBytes, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { signAccessToken } from '@/lib/auth';
import { getEnv } from '@/lib/env';
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

  const env = getEnv();
  const { sessions, users } = createRepositories();
  const session = await sessions.findByRefreshToken(parsed.data.refreshToken);
  if (!session) {
    return NextResponse.json(buildApiError('UNAUTHORIZED', 'Invalid refresh token'), { status: 401 });
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await sessions.deleteByRefreshToken(parsed.data.refreshToken);
    return NextResponse.json(buildApiError('UNAUTHORIZED', 'Refresh token expired'), { status: 401 });
  }

  const user = await users.findById(session.userId);
  if (!user || !user.isActive) {
    return NextResponse.json(buildApiError('UNAUTHORIZED', 'Invalid session user'), { status: 401 });
  }

  const accessToken = signAccessToken({ sub: user.id, role: 'admin' }, env.NEXTAUTH_SECRET);
  const rotatedRefreshToken = randomBytes(48).toString('hex');
  await sessions.deleteByRefreshToken(parsed.data.refreshToken);
  await sessions.create({
    id: randomUUID(),
    userId: user.id,
    refreshToken: rotatedRefreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const response = NextResponse.json({
    success: true,
    data: {
      accessToken,
      refreshToken: rotatedRefreshToken,
    },
  });
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set('refresh_token', rotatedRefreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
