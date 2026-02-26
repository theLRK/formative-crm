import { randomUUID, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { verifyPassword, signAccessToken } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { buildApiError } from '@/lib/errors';
import { getClientIp } from '@/lib/http/request';
import { consumeRateLimit } from '@/lib/security';
import { loginSchema } from '@/lib/validation';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rate = consumeRateLimit(`auth:login:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      buildApiError('FORBIDDEN', 'Too many login attempts. Try again later.'),
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid login payload'), {
      status: 400,
    });
  }

  const env = getEnv();
  const { users, sessions } = createRepositories();
  const user = await users.findByEmail(parsed.data.email);
  if (!user || !user.isActive) {
    return NextResponse.json(buildApiError('UNAUTHORIZED', 'Invalid credentials'), { status: 401 });
  }

  const matches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!matches) {
    return NextResponse.json(buildApiError('UNAUTHORIZED', 'Invalid credentials'), { status: 401 });
  }

  const accessToken = signAccessToken({ sub: user.id, role: 'admin' }, env.NEXTAUTH_SECRET);
  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await sessions.create({
    id: randomUUID(),
    userId: user.id,
    refreshToken,
    expiresAt,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
    },
  });
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
