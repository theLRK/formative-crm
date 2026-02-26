import { cleanInboundBody, processInboundEmailPoll, type InboundMessage } from '../../src/lib/emails';

function buildMessage(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    messageId: 'msg-1',
    threadId: 'thr-1',
    fromEmail: 'lead@example.com',
    subject: 'Re: Curated Property Options',
    body: 'I am ready to buy and schedule viewing this week.',
    receivedAt: new Date('2026-02-26T09:00:00.000Z'),
    ...overrides,
  };
}

function buildLead() {
  return {
    id: 'lead-1',
    email: 'lead@example.com',
    fullName: 'Samuel Lead',
    formScore: 80,
    interactionScore: 0,
    totalScore: 48,
    tier: 'Cold' as const,
    pipelineStatus: 'Contacted' as const,
    threadId: 'thr-1',
    lastEmailSentAt: '2026-02-26T06:00:00.000Z',
  };
}

describe('processInboundEmailPoll', () => {
  it('processes inbound reply, updates lead score, and creates pending draft', async () => {
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(buildLead()),
      update: vi.fn().mockResolvedValue({}),
    };
    const emails = {
      findByMessageId: vi.fn().mockResolvedValue(null),
      countInboundByLeadAndThread: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const summary = await processInboundEmailPoll({
      repositories: { leads, emails, logs },
      after: new Date('2026-02-26T08:00:00.000Z'),
      fetchInboundMessages: vi.fn().mockResolvedValue([
        buildMessage({
          body: 'I am ready to buy. Please schedule viewing this week as I am interested.',
        }),
      ]),
      generateDraft: vi.fn().mockResolvedValue('Draft reply body'),
      generateId: (() => {
        const ids = ['email-inbound-1', 'email-draft-1'];
        return () => ids.shift() ?? 'id-fallback';
      })(),
    });

    expect(summary).toEqual({
      fetched: 1,
      processed: 1,
      duplicates: 0,
      unmatched: 0,
      threadConflicts: 0,
      emptyIgnored: 0,
      draftsPendingApproval: 1,
      draftsNeedsReview: 0,
    });
    expect(leads.update).toHaveBeenCalledWith(
      'lead-1',
      expect.objectContaining({
        interactionScore: 80,
        totalScore: 80,
        tier: 'Hot',
        pipelineStatus: 'Interested',
      }),
    );
    expect(emails.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'email-inbound-1',
        leadId: 'lead-1',
        gmailMessageId: 'msg-1',
        direction: 'Inbound',
      }),
    );
    expect(emails.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'email-draft-1',
        leadId: 'lead-1',
        direction: 'Draft',
        draftStatus: 'PendingApproval',
      }),
    );
  });

  it('skips duplicate messages', async () => {
    const leads = {
      findByEmail: vi.fn(),
      update: vi.fn(),
    };
    const emails = {
      findByMessageId: vi.fn().mockResolvedValue({ id: 'existing-email' }),
      countInboundByLeadAndThread: vi.fn(),
      create: vi.fn(),
    };
    const logs = {
      create: vi.fn(),
    };

    const summary = await processInboundEmailPoll({
      repositories: { leads, emails, logs },
      fetchInboundMessages: vi.fn().mockResolvedValue([buildMessage()]),
      generateDraft: vi.fn(),
    });

    expect(summary.duplicates).toBe(1);
    expect(summary.processed).toBe(0);
    expect(leads.findByEmail).not.toHaveBeenCalled();
    expect(emails.create).not.toHaveBeenCalled();
  });

  it('flags thread conflicts and skips scoring and draft', async () => {
    const leads = {
      findByEmail: vi.fn().mockResolvedValue({
        ...buildLead(),
        threadId: 'different-thread',
      }),
      update: vi.fn(),
    };
    const emails = {
      findByMessageId: vi.fn().mockResolvedValue(null),
      countInboundByLeadAndThread: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const summary = await processInboundEmailPoll({
      repositories: { leads, emails, logs },
      fetchInboundMessages: vi.fn().mockResolvedValue([buildMessage()]),
      generateDraft: vi.fn(),
      generateId: () => 'inbound-only',
    });

    expect(summary.threadConflicts).toBe(1);
    expect(summary.processed).toBe(0);
    expect(leads.update).not.toHaveBeenCalled();
    expect(emails.create).toHaveBeenCalledTimes(1);
  });

  it('creates NeedsReview draft when AI generation fails', async () => {
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(buildLead()),
      update: vi.fn().mockResolvedValue({}),
    };
    const emails = {
      findByMessageId: vi.fn().mockResolvedValue(null),
      countInboundByLeadAndThread: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const summary = await processInboundEmailPoll({
      repositories: { leads, emails, logs },
      fetchInboundMessages: vi.fn().mockResolvedValue([buildMessage()]),
      generateDraft: vi.fn().mockRejectedValue(new Error('temporary AI outage')),
      generateId: (() => {
        const ids = ['email-inbound-1', 'email-draft-1'];
        return () => ids.shift() ?? 'id-fallback';
      })(),
    });

    expect(summary.draftsNeedsReview).toBe(1);
    expect(summary.draftsPendingApproval).toBe(0);
    expect(emails.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draftStatus: 'NeedsReview',
      }),
    );
  });

  it('skips unmatched sender email', async () => {
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    const emails = {
      findByMessageId: vi.fn().mockResolvedValue(null),
      countInboundByLeadAndThread: vi.fn(),
      create: vi.fn(),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const summary = await processInboundEmailPoll({
      repositories: { leads, emails, logs },
      fetchInboundMessages: vi.fn().mockResolvedValue([buildMessage()]),
      generateDraft: vi.fn(),
    });

    expect(summary.unmatched).toBe(1);
    expect(summary.processed).toBe(0);
    expect(emails.create).not.toHaveBeenCalled();
  });
});

describe('cleanInboundBody', () => {
  it('removes quoted content and signatures', () => {
    const cleaned = cleanInboundBody(
      [
        'Thanks, schedule viewing this week.',
        '',
        'On Tue, Feb 25, 2026 at 10:00 AM Agent wrote:',
        '> previous thread content',
      ].join('\n'),
    );
    expect(cleaned).toBe('Thanks, schedule viewing this week.');
  });
});
