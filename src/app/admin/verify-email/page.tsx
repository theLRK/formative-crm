'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  firebaseSendEmailVerification,
  firebaseSignInWithEmailPassword,
  isFirebaseClientConfigured,
} from '@/lib/firebase/auth-rest';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get('email') ?? '';
  const isFirebaseEnabled = isFirebaseClientConfigured();

  const [email, setEmail] = useState(queryEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isFormReady = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 8,
    [email, password],
  );

  async function resendVerification(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!isFirebaseEnabled) {
      setError('Firebase auth is not configured in this environment.');
      setLoading(false);
      return;
    }

    try {
      const session = await firebaseSignInWithEmailPassword(email, password);
      await firebaseSendEmailVerification(session.idToken);
      setMessage('Verification email sent. Open the link in your inbox, then return to sign in.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-gray-900">Verify Your Email</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your account exists, but email verification is required before CRM access.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Check your inbox for a verification link. If needed, resend below.
        </p>

        <form className="mt-6 space-y-4" onSubmit={resendVerification}>
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
              placeholder="you@example.com"
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
              placeholder="Your password"
            />
          </div>

          {error ? <div className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700">{message}</div> : null}

          <button
            type="submit"
            disabled={loading || !isFormReady || !isFirebaseEnabled}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <div className="flex items-center justify-between pt-1 text-sm">
            <Link className="text-blue-700 hover:text-blue-800" href="/admin/login">
              Back to Sign In
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
