'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';
import { buildLeadInsight, buildPortfolioInsight, type LeadUrgency } from '@/lib/leads/insights';
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

const STATUS_OPTIONS: Array<{ label: string; value: '' | PipelineStatus }> = [
  { label: 'All Statuses', value: '' },
  { label: 'New', value: 'New' },
  { label: 'Contacted', value: 'Contacted' },
  { label: 'Interested', value: 'Interested' },
  { label: 'Question', value: 'Question' },
  { label: 'Objection', value: 'Objection' },
  { label: 'Unqualified', value: 'Unqualified' },
  { label: 'Closed', value: 'Closed' },
];

const PIPELINE_EDIT_OPTIONS: PipelineStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Question',
  'Objection',
  'Unqualified',
  'Closed',
];

type SortOption = 'updated_desc' | 'score_desc' | 'score_asc' | 'name_asc' | 'priority_desc';

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function safeText(value: unknown, fallback = '-'): string {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function urgencyStyles(urgency: LeadUrgency): string {
  if (urgency === 'Critical') return 'bg-red-100 text-red-800';
  if (urgency === 'High') return 'bg-amber-100 text-amber-800';
  if (urgency === 'Medium') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
}

export default function AdminDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | PipelineStatus>('');
  const [minScore, setMinScore] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority_desc');
  const [statusDrafts, setStatusDrafts] = useState<Record<string, PipelineStatus>>({});
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);

  async function fetchLeads(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (minScore.trim()) params.set('minScore', minScore.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const payload = await apiRequest<LeadsResponse>(`/api/v1/leads${suffix}`);
      if (!payload.success || !payload.data) {
        setError(payload.error?.message ?? 'Failed to load leads');
        setLeads([]);
        return;
      }
      setLeads(payload.data.leads);
      const nextDrafts: Record<string, PipelineStatus> = {};
      for (const lead of payload.data.leads) {
        nextDrafts[lead.id] = lead.pipelineStatus;
      }
      setStatusDrafts(nextDrafts);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setError(error.message);
      } else {
        setError('Network error while loading leads');
      }
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveLeadStatus(leadId: string): Promise<void> {
    const nextStatus = statusDrafts[leadId];
    if (!nextStatus) return;
    setSavingLeadId(leadId);
    setError(null);
    try {
      const payload = await apiRequest<UpdateLeadResponse>(`/api/v1/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: nextStatus }),
      });
      if (!payload.success || !payload.data?.lead) {
        setError(payload.error?.message ?? 'Failed to update lead status');
        return;
      }
      const updatedLead = payload.data.lead;
      setLeads((current) =>
        current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)),
      );
      setStatusDrafts((current) => ({
        ...current,
        [updatedLead.id]: updatedLead.pipelineStatus,
      }));
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
      else setError('Network error while updating status');
    } finally {
      setSavingLeadId(null);
    }
  }

  async function logout(): Promise<void> {
    await apiRequest<{ success: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      skipAuthRefresh: true,
      redirectOnUnauthorized: false,
    }).catch(() => null);
    window.location.href = '/admin/login';
  }

  useEffect(() => {
    void fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, minScore]);

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter((lead) => {
      const values = [
        safeText(lead.fullName, ''),
        safeText(lead.email, ''),
        safeText(lead.pipelineStatus, ''),
        safeText(lead.tier, ''),
      ];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [leads, query]);

  const sortedLeads = useMemo(() => {
    const entries = [...filteredLeads];
    if (sortBy === 'score_desc') {
      entries.sort((a, b) => safeNumber(b.totalScore) - safeNumber(a.totalScore));
    } else if (sortBy === 'score_asc') {
      entries.sort((a, b) => safeNumber(a.totalScore) - safeNumber(b.totalScore));
    } else if (sortBy === 'name_asc') {
      entries.sort((a, b) => safeText(a.fullName, '').localeCompare(safeText(b.fullName, '')));
    } else if (sortBy === 'updated_desc') {
      entries.sort((a, b) => {
        const left = new Date(a.updatedAt).getTime();
        const right = new Date(b.updatedAt).getTime();
        return right - left;
      });
    } else {
      entries.sort((a, b) => buildLeadInsight(b).priorityScore - buildLeadInsight(a).priorityScore);
    }
    return entries;
  }, [filteredLeads, sortBy]);

  const portfolioInsight = useMemo(() => buildPortfolioInsight(leads), [leads]);

  const priorityQueue = useMemo(() => {
    return filteredLeads
      .filter((lead) => lead.pipelineStatus !== 'Closed')
      .map((lead) => ({ lead, insight: buildLeadInsight(lead) }))
      .sort((a, b) => b.insight.priorityScore - a.insight.priorityScore)
      .slice(0, 5);
  }, [filteredLeads]);

  const hotCount = leads.filter((lead) => lead.tier === 'Hot').length;
  const warmCount = leads.filter((lead) => lead.tier === 'Warm').length;
  const coldCount = leads.filter((lead) => lead.tier === 'Cold').length;

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Monitor lead quality, intent, and pending follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/queue"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Priority Queue
          </Link>
          <Link
            href="/admin/drafts"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Draft Queue
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Settings
          </Link>
          <Link
            href="/admin/logs"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Error Logs
          </Link>
          <button
            type="button"
            onClick={() => void fetchLeads()}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-lg bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Hot Leads</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">{hotCount}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Warm Leads</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{warmCount}</p>
        </div>
        <div className="rounded-lg bg-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700">Cold Leads</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{coldCount}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">SLA Risk</p>
          <p className="mt-1 text-2xl font-semibold text-red-900">{portfolioInsight.slaRiskCount}</p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">High Priority</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-900">{portfolioInsight.highPriorityCount}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">30d Viewing Forecast</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{portfolioInsight.projectedViewings30d}</p>
        </div>
      </section>

      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | PipelineStatus)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="Minimum score"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="Search by name, email, status, or tier"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="priority_desc">Sort: Priority (High-Low)</option>
            <option value="score_desc">Sort: Score (High-Low)</option>
            <option value="score_asc">Sort: Score (Low-High)</option>
            <option value="updated_desc">Sort: Updated (Newest)</option>
            <option value="name_asc">Sort: Name (A-Z)</option>
          </select>
        </div>

        {error ? <div className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Smart Priority Queue</h2>
            <span className="text-xs text-gray-500">Adapted from competitor-style CRM prioritization</span>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-gray-500">Building queue...</p>
          ) : priorityQueue.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No active leads in queue.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {priorityQueue.map(({ lead, insight }) => (
                <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <div>
                    <Link href={`/admin/leads/${lead.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                      {safeText(lead.fullName, 'Unnamed Lead')}
                    </Link>
                    <p className="text-xs text-gray-600">{insight.nextAction}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800">
                      Priority {insight.priorityScore}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${urgencyStyles(insight.urgency)}`}>
                      {insight.urgency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Lead
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Tier
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Total Score
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
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
                    Loading leads...
                  </td>
                </tr>
              ) : sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                    No leads found.
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <Link className="font-medium text-blue-700 hover:text-blue-800" href={`/admin/leads/${lead.id}`}>
                        {safeText(lead.fullName, 'Unnamed Lead')}
                      </Link>
                      <div className="text-xs text-gray-500">{safeText(lead.email)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-800">{safeText(lead.tier, 'Cold')}</td>
                    <td className="px-3 py-3 text-sm text-gray-800">{safeNumber(lead.totalScore).toFixed(1)}</td>
                    <td className="px-3 py-3 text-sm text-gray-800">
                      <div className="flex items-center gap-2">
                        <select
                          value={statusDrafts[lead.id] ?? lead.pipelineStatus}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [lead.id]: event.target.value as PipelineStatus,
                            }))
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
                        >
                          {PIPELINE_EDIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void saveLeadStatus(lead.id)}
                          disabled={savingLeadId === lead.id}
                          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-60"
                        >
                          {savingLeadId === lead.id ? 'Saving' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{formatDate(lead.lastEmailSentAt)}</td>
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
