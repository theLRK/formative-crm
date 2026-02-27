'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildLeadInsight, type LeadUrgency } from '@/lib/leads/insights';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';
import type { Lead, PipelineStatus } from '@/types';

interface LeadsResponse {
  success: boolean;
  data?: {
    count: number;
    leads: Lead[];
  };
  error?: {
    message: string;
  };
}

interface UpdateLeadResponse {
  success: boolean;
  data?: {
    lead: Lead;
  };
  error?: {
    message: string;
  };
}

function urgencyStyles(urgency: LeadUrgency): string {
  if (urgency === 'Critical') return 'bg-red-100 text-red-800';
  if (urgency === 'High') return 'bg-amber-100 text-amber-800';
  if (urgency === 'Medium') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
}

function formatHours(value: number | null): string {
  if (value === null) return 'No outbound yet';
  if (value < 1) return '<1h';
  return `${value}h`;
}

function formatLabel(status: PipelineStatus): string {
  if (status === 'Closed') return 'Archive (Close)';
  return `Mark ${status}`;
}

export default function AdminQueuePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [runningBulk, setRunningBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<'All' | LeadUrgency>('All');

  async function fetchLeads(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<LeadsResponse>('/api/v1/leads');
      if (!payload.success || !payload.data) {
        setError(payload.error?.message ?? 'Failed to load queue');
        setLeads([]);
        return;
      }
      setLeads(payload.data.leads);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else setError('Network error while loading queue');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchLeads();
  }, []);

  const queue = useMemo(() => {
    const ranked = leads
      .filter((lead) => lead.pipelineStatus !== 'Closed')
      .map((lead) => ({ lead, insight: buildLeadInsight(lead) }))
      .sort((a, b) => b.insight.priorityScore - a.insight.priorityScore);

    if (urgencyFilter === 'All') return ranked;
    return ranked.filter((item) => item.insight.urgency === urgencyFilter);
  }, [leads, urgencyFilter]);

  const selectedCount = selectedIds.size;

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(): void {
    if (queue.length === 0) return;
    const visibleIds = queue.map((item) => item.lead.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function runBulkStatusUpdate(status: PipelineStatus): Promise<void> {
    if (selectedIds.size === 0) return;
    setRunningBulk(true);
    setError(null);
    setMessage(null);

    let successCount = 0;
    let failureCount = 0;
    for (const id of selectedIds) {
      try {
        const response = await apiRequest<UpdateLeadResponse>(`/api/v1/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipelineStatus: status }),
        });
        if (response.success && response.data?.lead) successCount += 1;
        else failureCount += 1;
      } catch {
        failureCount += 1;
      }
    }

    if (failureCount === 0) {
      setMessage(`${successCount} lead(s) updated to ${status}.`);
    } else {
      setError(`${failureCount} update(s) failed. ${successCount} lead(s) updated.`);
    }

    setSelectedIds(new Set());
    await fetchLeads();
    setRunningBulk(false);
  }

  const canRunActions = selectedCount > 0 && !runningBulk;
  const allVisibleSelected = queue.length > 0 && queue.every((item) => selectedIds.has(item.lead.id));

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Priority Queue</h1>
          <p className="mt-1 text-sm text-gray-600">Execute next-best actions on highest-impact leads in bulk.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void fetchLeads()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="urgency-filter" className="text-sm font-medium text-gray-700">
              Urgency
            </label>
            <select
              id="urgency-filter"
              value={urgencyFilter}
              onChange={(event) => setUrgencyFilter(event.target.value as 'All' | LeadUrgency)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="All">All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium text-gray-900">{selectedCount}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canRunActions}
            onClick={() => void runBulkStatusUpdate('Contacted')}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formatLabel('Contacted')}
          </button>
          <button
            type="button"
            disabled={!canRunActions}
            onClick={() => void runBulkStatusUpdate('Interested')}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formatLabel('Interested')}
          </button>
          <button
            type="button"
            disabled={!canRunActions}
            onClick={() => void runBulkStatusUpdate('Closed')}
            className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formatLabel('Closed')}
          </button>
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            disabled={queue.length === 0 || runningBulk}
            className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {allVisibleSelected ? 'Unselect All Visible' : 'Select All Visible'}
          </button>
        </div>

        {error ? <div className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-4 rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700">{message}</div> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Select
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Lead
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Priority
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Next Action
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Last Email
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                    Loading queue...
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                    No leads in queue.
                  </td>
                </tr>
              ) : (
                queue.map(({ lead, insight }) => (
                  <tr key={lead.id}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelected(lead.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <Link href={`/admin/leads/${lead.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                        {lead.fullName || 'Unnamed Lead'}
                      </Link>
                      <div className="text-xs text-gray-500">{lead.email}</div>
                      <div className="text-xs text-gray-500">{lead.pipelineStatus}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-800">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{insight.priorityScore}</span>
                        <span className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${urgencyStyles(insight.urgency)}`}>
                          {insight.urgency}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <p>{insight.nextAction}</p>
                      <p className="mt-1 text-xs text-gray-500">{insight.rationale}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <p>{formatHours(insight.hoursSinceLastEmail)}</p>
                      {insight.slaRisk ? (
                        <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                          SLA Risk
                        </span>
                      ) : null}
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
