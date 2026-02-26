import {
  computeFormScore,
  computeInteractionScore,
  computeIntentScore,
  computeLengthScore,
  computeReplySpeedScore,
  computeTier,
  computeTotalScore,
  normalizeScoringConfig,
} from '../../src/lib/scoring';

describe('scoring utilities', () => {
  const config = normalizeScoringConfig({ premiumBudgetThreshold: 100_000_000 });

  it('computes total score with 0.6/0.4 weighting and one-decimal rounding', () => {
    expect(computeTotalScore(98.9, 85.5)).toBe(93.5);
  });

  it('maps score thresholds inclusively', () => {
    expect(computeTier(75.0)).toBe('Hot');
    expect(computeTier(74.9)).toBe('Warm');
    expect(computeTier(50.0)).toBe('Warm');
    expect(computeTier(49.9)).toBe('Cold');
  });

  it('computes form score deterministically with max 100', () => {
    const score = computeFormScore(
      {
        budget: 200_000_000,
        purchaseTimeline: 'immediate',
        paymentReadiness: 'cash_ready',
        locationMatch: 'core_area',
        propertyTypeSpecificity: 'specific',
      },
      config,
    );
    expect(score).toBe(100);
  });

  it('scores intent case-insensitively and keeps highest category only', () => {
    expect(computeIntentScore('Can we SCHEDULE VIEWING this week?')).toBe(40);
    expect(computeIntentScore('I am interested and maybe later')).toBe(25);
    expect(computeIntentScore('just checking for now')).toBe(10);
    expect(computeIntentScore('Hello')).toBe(0);
  });

  it('scores message length by word count bands', () => {
    expect(computeLengthScore('one two three four')).toBe(0);
    expect(computeLengthScore('one two three four five')).toBe(5);
    expect(computeLengthScore(new Array(20).fill('word').join(' '))).toBe(10);
    expect(computeLengthScore(new Array(50).fill('word').join(' '))).toBe(15);
  });

  it('scores reply speed from last_email_sent_at to reply', () => {
    const now = new Date('2026-02-26T10:00:00.000Z');
    expect(
      computeReplySpeedScore({
        lastEmailSentAt: new Date('2026-02-26T06:30:00.000Z'),
        replyReceivedAt: now,
        messageBody: 'schedule viewing',
        replyCountInThread: 1,
      }),
    ).toBe(30);
    expect(
      computeReplySpeedScore({
        lastEmailSentAt: new Date('2026-02-25T12:00:00.000Z'),
        replyReceivedAt: now,
        messageBody: 'interested',
        replyCountInThread: 1,
      }),
    ).toBe(20);
  });

  it('computes interaction score with all deterministic components', () => {
    const score = computeInteractionScore({
      lastEmailSentAt: new Date('2026-02-26T06:00:00.000Z'),
      replyReceivedAt: new Date('2026-02-26T09:00:00.000Z'),
      messageBody:
        'Hi, I am interested in this property and would like to schedule viewing this week if available.',
      replyCountInThread: 2,
    });
    expect(score).toBe(85);
  });
});
