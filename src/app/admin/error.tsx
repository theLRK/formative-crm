'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface AdminErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  useEffect(() => {
    console.error('Admin route error', error);
  }, [error]);

  return (
    <main className="mx-auto max-w-screen-md p-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Admin page error</h1>
        <p className="mt-2 text-sm text-gray-600">
          A runtime error occurred. You can retry the page or return to dashboard.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
