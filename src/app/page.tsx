import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <h1 className="text-3xl font-semibold text-gray-900">Formative CRM</h1>
      <p className="mt-3 text-gray-700">
        Single-agent CRM for lead intake, scoring, email thread tracking, and draft approval.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/login"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Admin Login
        </Link>
        <Link
          href="/admin/signup"
          className="inline-flex items-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
        >
          Create Account
        </Link>
        <Link
          href="/admin/queue"
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Open Priority Queue
        </Link>
      </div>
    </main>
  );
}
