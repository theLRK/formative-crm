import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { getBearerToken, getClientIp } from '@/lib/http/request';
import { consumeRateLimit } from '@/lib/security';

const PUBLIC_API_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/leads/webhook',
]);

function unauthorizedResponseFor(pathname: string, request: NextRequest): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token',
        },
      },
      { status: 401 },
    );
  }
  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  if (pathname === '/api/v1/emails/poll') {
    const env = getEnv();
    const cronSecret = request.headers.get('x-cron-secret');
    if (!cronSecret || cronSecret !== env.CRON_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Invalid cron secret',
          },
        },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    if (pathname === '/api/v1/leads/webhook') {
      const ip = getClientIp(request);
      const rate = consumeRateLimit(`webhook:${ip}`, 60, 60 * 1000);
      if (!rate.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Rate limit exceeded',
            },
          },
          { status: 429 },
        );
      }
    }
    return NextResponse.next();
  }

  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isProtectedApi = pathname.startsWith('/api/v1');
  if (!isAdminPage && !isProtectedApi) return NextResponse.next();

  const env = getEnv();
  const token =
    request.cookies.get('access_token')?.value ??
    getBearerToken(request) ??
    request.headers.get('x-access-token');

  if (!token) return unauthorizedResponseFor(pathname, request);

  try {
    const payload = verifyAccessToken(token, env.NEXTAUTH_SECRET);
    if (isProtectedApi) {
      const rate = consumeRateLimit(`admin-api:${payload.sub}`, 120, 60 * 1000);
      if (!rate.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Rate limit exceeded',
            },
          },
          { status: 429 },
        );
      }
    }
    return NextResponse.next();
  } catch {
    return unauthorizedResponseFor(pathname, request);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/:path*'],
};

