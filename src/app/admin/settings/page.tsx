'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';

type HealthState = 'ok' | 'warn' | 'error';

interface IntegrationHealth {
  key: string;
  label: string;
  state: HealthState;
  message: string;
}

interface SettingsHealthResponse {
  success: boolean;
  data?: {
    hasError: boolean;
    integrations: IntegrationHealth[];
  };
  error?: {
    message: string;
  };
}

function healthStyles(state: HealthState): string {
  if (state === 'ok') return 'bg-emerald-100 text-emerald-800';
  if (state === 'warn') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export default function AdminSettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHealth(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<SettingsHealthResponse>('/api/v1/settings/health');
      if (!payload.success || !payload.data) {
        setIntegrations([]);
        setError(payload.error?.message ?? 'Failed to load settings health');
        return;
      }
      setIntegrations(payload.data.integrations);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else setError('Network error while loading settings');
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchHealth();
  }, []);

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Integration health and environment readiness for Formative CRM operations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchHealth()}
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
        {error ? <div className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Integration
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500">
                    Checking integrations...
                  </td>
                </tr>
              ) : integrations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500">
                    No settings data available.
                  </td>
                </tr>
              ) : (
                integrations.map((integration) => (
                  <tr key={integration.key}>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">{integration.label}</td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${healthStyles(integration.state)}`}>
                        {integration.state.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{integration.message}</td>
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
