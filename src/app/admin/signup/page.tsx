'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseSignUpWithEmailPassword, isFirebaseClientConfigured } from '@/lib/firebase/auth-rest';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

export default function AdminSignUpPage() {
  const router = useRouter();
  const isFirebaseEnabled = isFirebaseClientConfigured();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordError = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!isFirebaseEnabled) {
      setError('Firebase auth is not configured in this environment.');
      setLoading(false);
      return;
    }
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const firebaseSession = await firebaseSignUpWithEmailPassword(email, password);
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
        setError(payload.error?.message ?? 'Failed to create app session');
        return;
      }
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-gray-900">Create Admin Account</h1>
        <p className="mt-2 text-sm text-gray-600">
          Use your real email to create a secure admin account for Formative CRM.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Auth mode: {isFirebaseEnabled ? 'Firebase Email/Password' : 'Not configured'}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="StrongPass1"
            />
            {passwordError ? <p className="text-xs text-amber-700">{passwordError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="StrongPass1"
            />
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <p className="text-xs text-amber-700">Passwords do not match.</p>
            ) : null}
          </div>

          {error ? <div className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="submit"
            disabled={loading || !isFirebaseEnabled}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="pt-1 text-sm">
            <Link className="text-blue-700 hover:text-blue-800" href="/admin/login">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
