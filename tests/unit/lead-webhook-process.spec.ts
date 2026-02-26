import { DuplicateLeadError } from '../../src/lib/leads/duplicate-check';
import { InitialEmailSendError, processLeadWebhook } from '../../src/lib/leads/process-webhook';

function buildPayload() {
  return {
    idempotencyKey: 'idem-12345678',
    fullName: 'Samuel Agent',
    email: 'lead@example.com',
    phone: '+2348012345678',
    budget: 150000000,
    purchaseTimeline: 'Immediate (0-1 month)',
    paymentReadiness: 'Cash ready',
    locationPreference: 'Lekki',
    propertyType: '3 bedroom duplex',
    message: 'I would like to schedule a viewing this week.',
  };
}

describe('processLeadWebhook', () => {
  it('creates lead, sends email, and updates lead status', async () => {
    const payload = buildPayload();
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      update: vi.fn().mockResolvedValue({}),
    };
    const emails = {
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };
    const sendInitialEmail = vi.fn().mockResolvedValue({
      messageId: 'msg-1',
      threadId: 'thr-1',
    });

    const result = await processLeadWebhook(payload, {
      repositories: { leads, emails, logs },
      scoringConfig: { premiumBudgetThreshold: 100000000 },
      sendInitialEmail,
      generateId: (() => {
        const ids = ['lead-1', 'email-1'];
        return () => ids.shift() ?? 'fallback-id';
      })(),
      now: () => new Date('2026-02-26T10:00:00.000Z'),
    });

    expect(result.leadId).toBe('lead-1');
    expect(result.messageId).toBe('msg-1');
    expect(result.threadId).toBe('thr-1');
    expect(result.tier).toBe('Warm');
    expect(leads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lead-1',
        pipelineStatus: 'New',
      }),
    );
    expect(emails.create).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        gmailMessageId: 'msg-1',
        threadId: 'thr-1',
        direction: 'Outbound',
      }),
    );
    expect(leads.update).toHaveBeenCalledWith(
      'lead-1',
      expect.objectContaining({
        pipelineStatus: 'Contacted',
        threadId: 'thr-1',
      }),
    );
  });

  it('throws duplicate error when email already exists', async () => {
    const payload = buildPayload();
    const leads = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'existing' }),
      create: vi.fn(),
      update: vi.fn(),
    };
    const emails = {
      create: vi.fn(),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    await expect(
      processLeadWebhook(payload, {
        repositories: { leads, emails, logs },
        scoringConfig: { premiumBudgetThreshold: 100000000 },
        sendInitialEmail: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(DuplicateLeadError);
    expect(leads.create).not.toHaveBeenCalled();
  });

  it('retries initial email once before succeeding', async () => {
    const payload = buildPayload();
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      update: vi.fn().mockResolvedValue({}),
    };
    const emails = {
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const sendInitialEmail = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary network issue'))
      .mockResolvedValueOnce({
        messageId: 'msg-1',
        threadId: 'thr-1',
      });

    await processLeadWebhook(payload, {
      repositories: { leads, emails, logs },
      scoringConfig: { premiumBudgetThreshold: 100000000 },
      sendInitialEmail,
    });

    expect(sendInitialEmail).toHaveBeenCalledTimes(2);
  });

  it('throws InitialEmailSendError when initial email fails after retry', async () => {
    const payload = buildPayload();
    const leads = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      update: vi.fn().mockResolvedValue({}),
    };
    const emails = {
      create: vi.fn().mockResolvedValue({}),
    };
    const logs = {
      create: vi.fn().mockResolvedValue({}),
    };

    const sendInitialEmail = vi.fn().mockRejectedValue(new Error('smtp down'));

    await expect(
      processLeadWebhook(payload, {
        repositories: { leads, emails, logs },
        scoringConfig: { premiumBudgetThreshold: 100000000 },
        sendInitialEmail,
      }),
    ).rejects.toBeInstanceOf(InitialEmailSendError);
  });
});
