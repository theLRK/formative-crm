'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseSignInWithEmailPassword, isFirebaseClientConfigured } from '@/lib/firebase/auth-rest';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const maybeError = payload as Partial<ApiErrorResponse>;
    if (maybeError.error?.message) return maybeError.error.message;
  }
  return fallback;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const isFirebaseEnabled = isFirebaseClientConfigured();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isFirebaseEnabled) {
        const firebaseSession = await firebaseSignInWithEmailPassword(email, password);
        const payload = await apiRequest<{ success: boolean; error?: { message: string } }>(
          '/api/v1/auth/firebase/exchange',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: firebaseSession.idToken }),
            skipAuthRefresh: true,
            redirectOnUnauthorized: false,
          },
        );
        if (!payload.success) {
          setError(payload.error?.message ?? 'Failed to establish app session');
          return;
        }
      } else {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          setError(readErrorMessage(payload, 'Failed to sign in'));
          return;
        }
        setInfo('Signed in via legacy auth mode (Firebase not configured).');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Login</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to review leads, approve drafts, and manage your pipeline.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Auth mode: {isFirebaseEnabled ? 'Firebase Email/Password' : 'Legacy password (fallback)'}
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Password123"
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {info ? <div className="rounded-lg bg-blue-100 px-4 py-2 text-sm text-blue-700">{info}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
            <Link className="text-blue-700 hover:text-blue-800" href="/admin/signup">
              Create account
            </Link>
            <Link className="text-blue-700 hover:text-blue-800" href="/admin/forgot-password">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
