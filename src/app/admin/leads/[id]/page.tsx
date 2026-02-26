'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/http/client-api';
import type { EmailRecord, Lead, PipelineStatus } from '@/types';

interface LeadDetailPageProps {
  params: { id: string };
}

interface LeadDetailResponse {
  success: boolean;
  data?: {
    lead: Lead;
    emails: EmailRecord[];
  };
  error?: {
    message: string;
  };
}

const STATUS_OPTIONS: PipelineStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Question',
  'Objection',
  'Unqualified',
  'Closed',
];

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

function directionStyles(direction: EmailRecord['direction']): string {
  if (direction === 'Inbound') return 'bg-blue-50 text-blue-800';
  if (direction === 'Outbound') return 'bg-gray-100 text-gray-700';
  return 'bg-amber-100 text-amber-800';
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<PipelineStatus>('New');
  const [draftBody, setDraftBody] = useState('');

  async function loadLead(): Promise<void> {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await apiRequest<LeadDetailResponse>(`/api/v1/leads/${params.id}`);
      if (!payload.success || !payload.data) {
        setError(payload?.error?.message ?? 'Failed to load lead detail');
        return;
      }

      setLead(payload.data.lead);
      setEmails(payload.data.emails);
      setSelectedStatus(payload.data.lead.pipelineStatus);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setError(error.message);
      } else {
        setError('Network error while loading lead detail');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const activeDraft = useMemo(() => {
    const drafts = emails.filter((item) => item.direction === 'Draft');
    const pending = drafts.find((item) => item.draftStatus === 'PendingApproval');
    return pending ?? drafts[0] ?? null;
  }, [emails]);

  useEffect(() => {
    if (activeDraft) {
      setDraftBody(activeDraft.body);
    } else {
      setDraftBody('');
    }
  }, [activeDraft]);

  async function updatePipelineStatus(nextStatus: PipelineStatus): Promise<void> {
    if (!lead) return;
    setSavingStatus(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await apiRequest<LeadDetailResponse>(`/api/v1/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: nextStatus }),
      });
      if (!payload.success || !payload.data) {
        setError(payload?.error?.message ?? 'Failed to update lead status');
        return;
      }
      setLead(payload.data.lead);
      setSelectedStatus(payload.data.lead.pipelineStatus);
      setMessage('Lead status updated.');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setError(error.message);
      } else {
        setError('Network error while updating lead status');
      }
    } finally {
      setSavingStatus(false);
    }
  }

  async function approveAndSendDraft(): Promise<void> {
    if (!activeDraft || !lead || activeDraft.draftStatus !== 'PendingApproval') return;
    setSendingDraft(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await apiRequest<{ success: boolean; error?: { message: string } }>(
        `/api/v1/emails/${activeDraft.id}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: activeDraft.id,
            threadId: activeDraft.threadId,
            body: draftBody,
            expectedStatus: 'PendingApproval',
          }),
        },
      );
      if (!payload?.success) {
        setError(payload?.error?.message ?? 'Failed to send approved draft');
        return;
      }

      setMessage('Draft sent successfully.');
      await loadLead();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setError(error.message);
      } else {
        setError('Network error while sending draft');
      }
    } finally {
      setSendingDraft(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-xl p-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Loading lead...</p>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="mx-auto max-w-screen-xl p-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{error ?? 'Lead not found.'}</p>
          <Link href="/admin/dashboard" className="mt-3 inline-block text-sm text-blue-700 hover:text-blue-800">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{safeText(lead.fullName, 'Unnamed Lead')}</h1>
          <p className="mt-1 text-sm text-gray-600">{safeText(lead.email)}</p>
          <p className="mt-1 text-xs text-gray-500">Lead ID: {lead.id}</p>
        </div>
        <Link href="/admin/dashboard" className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-900 hover:bg-gray-300">
          Back
        </Link>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Lead Metadata</h2>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Tier:</span> {safeText(lead.tier, 'Cold')}
            </p>
            <p>
              <span className="font-medium">Pipeline:</span> {safeText(lead.pipelineStatus, 'New')}
            </p>
            <p>
              <span className="font-medium">Budget:</span> {lead.budget ?? '-'}
            </p>
            <p>
              <span className="font-medium">Last Email:</span> {formatDate(lead.lastEmailSentAt)}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <label htmlFor="pipeline-status" className="text-sm font-medium text-gray-700">
              Update Pipeline Status
            </label>
            <select
              id="pipeline-status"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as PipelineStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => void updatePipelineStatus(selectedStatus)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingStatus ? 'Saving...' : 'Save Status'}
              </button>
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => void updatePipelineStatus('Closed')}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-60"
              >
                Mark Closed
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Score Breakdown</h2>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">FormScore:</span> {safeNumber(lead.formScore).toFixed(1)}
            </p>
            <p>
              <span className="font-medium">InteractionScore:</span> {safeNumber(lead.interactionScore).toFixed(1)}
            </p>
            <p>
              <span className="font-medium">TotalScore:</span> {safeNumber(lead.totalScore).toFixed(1)}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Draft Approval</h2>
          {activeDraft ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                Draft status: <span className="font-medium">{activeDraft.draftStatus ?? '-'}</span>
              </p>
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                className="mt-3 h-48 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
              <button
                type="button"
                disabled={sendingDraft || activeDraft.draftStatus !== 'PendingApproval'}
                onClick={() => void approveAndSendDraft()}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingDraft ? 'Sending...' : 'Approve and Send'}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No draft available for this lead.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Conversation Timeline</h2>
        {emails.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No messages yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {emails.map((email) => (
              <article key={email.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${directionStyles(email.direction)}`}>
                    {email.direction}
                  </span>
                  <p className="text-xs text-gray-500">{formatDate(email.sentAt ?? email.createdAt)}</p>
                  {email.draftStatus ? (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {email.draftStatus}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-800">{email.subject ?? '(No subject)'}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{email.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {error ? <div className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="mt-4 rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700">{message}</div> : null}
    </main>
  );
}
