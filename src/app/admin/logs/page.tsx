'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';
import type { LogRecord } from '@/types';

type LogLevelFilter = '' | 'info' | 'warn' | 'error';

interface LogsResponse {
  success: boolean;
  data?: {
    count: number;
    logs: LogRecord[];
  };
  error?: {
    message: string;
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function levelBadge(level: LogRecord['level']): string {
  if (level === 'error') return 'bg-red-100 text-red-700';
  if (level === 'warn') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<LogLevelFilter>('');
  const [limit, setLimit] = useState('50');

  async function fetchLogs(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (limit.trim()) params.set('limit', limit.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const payload = await apiRequest<LogsResponse>(`/api/v1/logs${suffix}`);
      if (!payload.success || !payload.data) {
        setError(payload.error?.message ?? 'Failed to load logs');
        setLogs([]);
        return;
      }
      setLogs(payload.data.logs);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Network error while loading logs');
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, limit]);

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">System Logs</h1>
          <p className="mt-1 text-sm text-gray-600">Operational events, warnings, and errors from Formative CRM.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchLogs()}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
          >
            Refresh
          </button>
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as LogLevelFilter)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="Limit"
          />
        </div>

        {error ? <div className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Level
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Message
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-3 text-xs text-gray-600">{formatDate(entry.createdAt)}</td>
                    <td className="px-3 py-3 text-xs">
                      <span className={`rounded-full px-2 py-1 font-medium ${levelBadge(entry.level)}`}>
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">{entry.message}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <pre className="max-w-[540px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2">
                        {entry.metadata ? JSON.stringify(entry.metadata, null, 2) : '-'}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
