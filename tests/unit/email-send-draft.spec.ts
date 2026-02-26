import {
  DraftNotFoundError,
  DraftStatusMismatchError,
  LeadNotFoundError,
  ThreadMismatchError,
  sendApprovedDraft,
} from '../../src/lib/emails/send-draft';

function buildDraft() {
  return {
    id: 'draft-1',
    leadId: 'lead-1',
    gmailMessageId: null,
    threadId: 'thr-1',
    direction: 'Draft' as const,
    subject: 'Re: Curated Property Options',
    body: 'Generated draft',
    draftStatus: 'PendingApproval' as const,
    sentAt: null,
    createdAt: '2026-02-26T10:00:00.000Z',
    updatedAt: '2026-02-26T10:00:00.000Z',
  };
}

function buildLead() {
  return {
    id: 'lead-1',
    fullName: 'Lead User',
    email: 'lead@example.com',
    phone: null,
    budget: 120000000,
    formScore: 90,
    interactionScore: 70,
    totalScore: 82,
    tier: 'Hot' as const,
    pipelineStatus: 'Interested' as const,
    threadId: 'thr-1',
    lastEmailSentAt: '2026-02-26T09:30:00.000Z',
    createdAt: '2026-02-26T09:00:00.000Z',
    updatedAt: '2026-02-26T09:30:00.000Z',
  };
}

describe('sendApprovedDraft', () => {
  it('sends approved draft and updates records', async () => {
    const leads = {
      getById: vi.fn().mockResolvedValue(buildLead()),
      update: vi.fn().mockResolvedValue(buildLead()),
    };
    const emails = {
      getById: vi.fn().mockResolvedValue(buildDraft()),
      create: vi.fn().mockResolvedValue({}),
      updateDraftStatus: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };
    const sendReply = vi.fn().mockResolvedValue({
      messageId: 'msg-123',
      threadId: 'thr-1',
    });

    const result = await sendApprovedDraft(
      {
        draftId: 'draft-1',
        expectedStatus: 'PendingApproval',
        body: 'Approved by agent',
        threadId: 'thr-1',
      },
      {
        repositories: { leads, emails, logs },
        sendReply,
        generateId: () => 'outbound-1',
        now: () => new Date('2026-02-26T11:00:00.000Z'),
      },
    );

    expect(result.sentMessageId).toBe('msg-123');
    expect(sendReply).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'lead@example.com',
        threadId: 'thr-1',
        body: 'Approved by agent',
      }),
    );
    expect(emails.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'outbound-1',
        direction: 'Outbound',
        gmailMessageId: 'msg-123',
      }),
    );
    expect(leads.update).toHaveBeenCalledWith(
      'lead-1',
      expect.objectContaining({
        lastEmailSentAt: '2026-02-26T11:00:00.000Z',
      }),
    );
    expect(emails.updateDraftStatus).toHaveBeenCalledWith('draft-1', 'Sent');
  });

  it('throws DraftNotFoundError when draft does not exist', async () => {
    const leads = {
      getById: vi.fn(),
      update: vi.fn(),
    };
    const emails = {
      getById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateDraftStatus: vi.fn(),
    };
    const logs = {
      create: vi.fn(),
    };

    await expect(
      sendApprovedDraft(
        {
          draftId: 'missing',
          expectedStatus: 'PendingApproval',
          body: 'Approved by agent',
          threadId: 'thr-1',
        },
        {
          repositories: { leads, emails, logs },
          sendReply: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(DraftNotFoundError);
  });

  it('throws DraftStatusMismatchError when draft status differs', async () => {
    const leads = {
      getById: vi.fn(),
      update: vi.fn(),
    };
    const emails = {
      getById: vi.fn().mockResolvedValue({
        ...buildDraft(),
        draftStatus: 'NeedsReview',
      }),
      create: vi.fn(),
      updateDraftStatus: vi.fn(),
    };
    const logs = {
      create: vi.fn(),
    };

    await expect(
      sendApprovedDraft(
        {
          draftId: 'draft-1',
          expectedStatus: 'PendingApproval',
          body: 'Approved by agent',
          threadId: 'thr-1',
        },
        {
          repositories: { leads, emails, logs },
          sendReply: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(DraftStatusMismatchError);
  });

  it('throws DraftStatusMismatchError when expected status is not PendingApproval', async () => {
    const leads = {
      getById: vi.fn(),
      update: vi.fn(),
    };
    const emails = {
      getById: vi.fn(),
      create: vi.fn(),
      updateDraftStatus: vi.fn(),
    };
    const logs = {
      create: vi.fn(),
    };

    await expect(
      sendApprovedDraft(
        {
          draftId: 'draft-1',
          expectedStatus: 'Sent',
          body: 'Approved by agent',
          threadId: 'thr-1',
        },
        {
          repositories: { leads, emails, logs },
          sendReply: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(DraftStatusMismatchError);
    expect(emails.getById).not.toHaveBeenCalled();
  });

  it('throws LeadNotFoundError when lead does not exist', async () => {
    const leads = {
      getById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    const emails = {
      getById: vi.fn().mockResolvedValue(buildDraft()),
      create: vi.fn(),
      updateDraftStatus: vi.fn(),
    };
    const logs = {
      create: vi.fn(),
    };

    await expect(
      sendApprovedDraft(
        {
          draftId: 'draft-1',
          expectedStatus: 'PendingApproval',
          body: 'Approved by agent',
          threadId: 'thr-1',
        },
        {
          repositories: { leads, emails, logs },
          sendReply: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it('throws ThreadMismatchError when Gmail response thread differs', async () => {
    const leads = {
      getById: vi.fn().mockResolvedValue(buildLead()),
      update: vi.fn(),
    };
    const emails = {
      getById: vi.fn().mockResolvedValue(buildDraft()),
      create: vi.fn(),
      updateDraftStatus: vi.fn(),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    await expect(
      sendApprovedDraft(
        {
          draftId: 'draft-1',
          expectedStatus: 'PendingApproval',
          body: 'Approved by agent',
          threadId: 'thr-1',
        },
        {
          repositories: { leads, emails, logs },
          sendReply: vi.fn().mockResolvedValue({
            messageId: 'msg-123',
            threadId: 'different-thread',
          }),
        },
      ),
    ).rejects.toBeInstanceOf(ThreadMismatchError);
  });
});
