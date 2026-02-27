import { buildLeadInsight, buildPortfolioInsight } from '../../src/lib/leads/insights';
import type { Lead } from '../../src/types';

function leadFixture(overrides?: Partial<Lead>): Lead {
  return {
    id: 'lead-1',
    fullName: 'Test Lead',
    email: 'lead@example.com',
    phone: '+2348000000000',
    budget: 120000000,
    formScore: 78.2,
    interactionScore: 40.5,
    totalScore: 63.1,
    tier: 'Warm',
    pipelineStatus: 'Contacted',
    threadId: 'thread-1',
    lastEmailSentAt: '2026-02-25T08:00:00.000Z',
    createdAt: '2026-02-24T08:00:00.000Z',
    updatedAt: '2026-02-25T08:00:00.000Z',
    ...overrides,
  };
}

describe('lead insights', () => {
  it('flags SLA risk for leads with no outbound contact yet', () => {
    const lead = leadFixture({
      pipelineStatus: 'New',
      lastEmailSentAt: null,
      totalScore: 82.4,
      tier: 'Hot',
    });

    const insight = buildLeadInsight(lead, new Date('2026-02-26T08:00:00.000Z'));
    expect(insight.slaRisk).toBe(true);
    expect(insight.nextAction.toLowerCase()).toContain('send first response');
    expect(['High', 'Critical']).toContain(insight.urgency);
  });

  it('downgrades closed leads and recommends no action', () => {
    const lead = leadFixture({
      pipelineStatus: 'Closed',
      tier: 'Hot',
      totalScore: 88.5,
    });

    const insight = buildLeadInsight(lead, new Date('2026-02-26T08:00:00.000Z'));
    expect(insight.priorityScore).toBe(0);
    expect(insight.urgency).toBe('Low');
    expect(insight.nextAction).toContain('No action required');
  });

  it('builds portfolio view with forecast and priority counts', () => {
    const leads = [
      leadFixture({ id: 'l1', tier: 'Hot', pipelineStatus: 'Interested', totalScore: 86 }),
      leadFixture({ id: 'l2', tier: 'Warm', pipelineStatus: 'Contacted', totalScore: 62 }),
      leadFixture({ id: 'l3', tier: 'Cold', pipelineStatus: 'Unqualified', totalScore: 35 }),
    ];

    const portfolio = buildPortfolioInsight(leads, new Date('2026-02-26T08:00:00.000Z'));
    expect(portfolio.projectedViewings30d).toBeGreaterThan(0.4);
    expect(portfolio.highPriorityCount).toBeGreaterThanOrEqual(1);
    expect(portfolio.slaRiskCount).toBeGreaterThanOrEqual(0);
  });
});
