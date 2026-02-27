import { randomBytes, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@/lib/airtable';
import { hashPassword, signAccessToken } from '@/lib/auth';
import { verifyFirebaseIdToken } from '@/lib/firebase/identity';
import { buildApiError } from '@/lib/errors';
import { getClientIp } from '@/lib/http/request';
import { consumeRateLimit } from '@/lib/security';
import { firebaseExchangeSchema } from '@/lib/validation';

function readJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || !secret.trim()) throw new Error('NEXTAUTH_SECRET is missing');
  return secret.trim();
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rate = consumeRateLimit(`auth:firebase:exchange:${ip}`, 30, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(buildApiError('FORBIDDEN', 'Too many auth attempts. Try again later.'), {
      status: 429,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = firebaseExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildApiError('VALIDATION_ERROR', 'Invalid Firebase token payload'), {
      status: 400,
    });
  }

  try {
    const identity = await verifyFirebaseIdToken(parsed.data.idToken);
    if (identity.disabled) {
      return NextResponse.json(buildApiError('UNAUTHORIZED', 'Firebase account is disabled'), {
        status: 401,
      });
    }
    if (!identity.emailVerified) {
      return NextResponse.json(buildApiError('FORBIDDEN', 'Please verify your email before signing in.'), {
        status: 403,
      });
    }

    const { users, sessions } = createRepositories();
    let user = await users.findByEmail(identity.email);
    if (!user) {
      const randomPassword = randomBytes(24).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      user = await users.create({
        id: randomUUID(),
        email: identity.email,
        passwordHash,
      });
    }

    if (!user.isActive) {
      return NextResponse.json(buildApiError('UNAUTHORIZED', 'User account is inactive'), {
        status: 401,
      });
    }

    const accessToken = signAccessToken({ sub: user.id, role: 'admin' }, readJwtSecret());
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
        user: {
          id: user.id,
          email: user.email,
          emailVerified: identity.emailVerified,
        },
      },
    });

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to authenticate with Firebase';
    const unauthorized = message.includes('Invalid Firebase ID token') || message.includes('disabled');
    const misconfigured = message.includes('missing');
    return NextResponse.json(buildApiError(unauthorized ? 'UNAUTHORIZED' : 'INTERNAL_ERROR', message), {
      status: unauthorized ? 401 : misconfigured ? 500 : 502,
    });
  }
}
