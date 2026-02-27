'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { firebaseSendPasswordReset, isFirebaseClientConfigured } from '@/lib/firebase/auth-rest';

export default function ForgotPasswordPage() {
  const isFirebaseEnabled = isFirebaseClientConfigured();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      await firebaseSendPasswordReset(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-gray-900">Reset Password</h1>
        <p className="mt-2 text-sm text-gray-600">Enter your account email to receive a password reset link.</p>

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
              placeholder="you@example.com"
            />
          </div>

          {error ? <div className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700">{message}</div> : null}

          <button
            type="submit"
            disabled={loading || !isFirebaseEnabled}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div className="pt-1 text-sm">
            <Link className="text-blue-700 hover:text-blue-800" href="/admin/login">
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
