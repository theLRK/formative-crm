'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';
import type { DraftStatus, EmailRecord, PipelineStatus, Tier } from '@/types';

interface DraftItem {
  draft: EmailRecord;
  lead: {
    id: string;
    fullName: string;
    email: string;
    tier: Tier;
    pipelineStatus: PipelineStatus;
  } | null;
}

interface DraftsResponse {
  success: boolean;
  data?: {
    count: number;
    items: DraftItem[];
  };
  error?: {
    message: string;
  };
}

const STATUS_OPTIONS: Array<{ label: string; value: '' | DraftStatus }> = [
  { label: 'All Drafts', value: '' },
  { label: 'Pending Approval', value: 'PendingApproval' },
  { label: 'Needs Review', value: 'NeedsReview' },
  { label: 'Sent', value: 'Sent' },
];

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function draftBadge(status: DraftStatus | null): string {
  if (status === 'PendingApproval') return 'bg-amber-100 text-amber-800';
  if (status === 'NeedsReview') return 'bg-red-100 text-red-800';
  if (status === 'Sent') return 'bg-emerald-100 text-emerald-800';
  return 'bg-gray-100 text-gray-700';
}

export default function AdminDraftsPage() {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | DraftStatus>('PendingApproval');

  async function fetchDrafts(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', '100');
      const payload = await apiRequest<DraftsResponse>(`/api/v1/emails/drafts?${params.toString()}`);
      if (!payload.success || !payload.data) {
        setItems([]);
        setError(payload.error?.message ?? 'Failed to load drafts');
        return;
      }
      setItems(payload.data.items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else setError('Network error while loading drafts');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Draft Queue</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review AI-generated drafts and jump directly into lead conversations for approval.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchDrafts()}
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
        <div className="max-w-sm">
          <label htmlFor="draft-status" className="mb-1 block text-sm font-medium text-gray-700">
            Draft Status
          </label>
          <select
            id="draft-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | DraftStatus)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error ? <div className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Lead
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Draft Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Updated
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    Loading drafts...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    No drafts found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.draft.id}>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      {item.lead ? (
                        <>
                          <p className="font-medium">{item.lead.fullName}</p>
                          <p className="text-xs text-gray-500">{item.lead.email}</p>
                        </>
                      ) : (
                        <p className="text-xs text-red-700">Lead not found</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${draftBadge(item.draft.draftStatus)}`}>
                        {item.draft.draftStatus ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{formatDate(item.draft.updatedAt)}</td>
                    <td className="px-3 py-3 text-sm">
                      {item.lead ? (
                        <Link
                          href={`/admin/leads/${item.lead.id}`}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Open Lead
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-500">Unavailable</span>
                      )}
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
