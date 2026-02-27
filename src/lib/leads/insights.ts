import type { Lead } from '@/types';

export type LeadUrgency = 'Critical' | 'High' | 'Medium' | 'Low';

export interface LeadInsight {
  priorityScore: number;
  urgency: LeadUrgency;
  nextAction: string;
  rationale: string;
  slaRisk: boolean;
  staleLead: boolean;
  hoursSinceLastEmail: number | null;
}

export interface PortfolioInsight {
  projectedViewings30d: number;
  highPriorityCount: number;
  slaRiskCount: number;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(from: Date | null, to: Date): number | null {
  if (!from) return null;
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildLeadInsight(lead: Lead, now = new Date()): LeadInsight {
  const hoursSinceLastEmail = hoursBetween(toDate(lead.lastEmailSentAt), now);
  const status = lead.pipelineStatus;
  const isClosed = status === 'Closed';

  const hasNeverSentEmail = !lead.lastEmailSentAt;
  const staleLead = !isClosed && hoursSinceLastEmail !== null && hoursSinceLastEmail >= 24;
  const slaRisk = !isClosed && (hasNeverSentEmail || staleLead);

  let priority = lead.totalScore;
  if (lead.tier === 'Hot') priority += 20;
  if (lead.tier === 'Warm') priority += 10;
  if (status === 'New') priority += 25;
  if (status === 'Question' || status === 'Objection') priority += 15;
  if (status === 'Interested') priority += 12;
  if (hasNeverSentEmail && !isClosed) priority += 20;
  if (hoursSinceLastEmail !== null && hoursSinceLastEmail >= 24) priority += 15;
  if (hoursSinceLastEmail !== null && hoursSinceLastEmail >= 72) priority += 10;
  if (isClosed) priority -= 100;

  const priorityScore = isClosed ? 0 : clamp(Math.round(priority), 0, 150);

  let urgency: LeadUrgency = 'Low';
  if (priorityScore >= 95) urgency = 'Critical';
  else if (priorityScore >= 75) urgency = 'High';
  else if (priorityScore >= 50) urgency = 'Medium';

  let nextAction = 'Monitor activity and keep nurturing.';
  const reasons: string[] = [];

  if (isClosed) {
    nextAction = 'No action required. Lead is closed.';
    reasons.push('Pipeline status is Closed');
  } else if (status === 'New' || hasNeverSentEmail) {
    nextAction = 'Send first response now and propose 2 viewing slots.';
    reasons.push('No outbound email sent yet');
  } else if (status === 'Objection' || status === 'Question') {
    nextAction = 'Address objection/question with a tailored response.';
    reasons.push(`Lead is in ${status} stage`);
  } else if (lead.tier === 'Hot') {
    nextAction = 'Call now and lock a viewing date this week.';
    reasons.push('Lead tier is Hot');
  } else if (status === 'Interested') {
    nextAction = 'Send curated listings and ask for preferred viewing time.';
    reasons.push('Lead already signaled interest');
  }

  if (staleLead) reasons.push('No follow-up in the last 24+ hours');
  if (lead.interactionScore >= 70) reasons.push('Strong interaction signals');
  if (lead.totalScore >= 75) reasons.push('High conversion potential');

  const rationale = reasons.length > 0 ? reasons.slice(0, 2).join(' | ') : 'No strong signals yet';

  return {
    priorityScore,
    urgency,
    nextAction,
    rationale,
    slaRisk,
    staleLead,
    hoursSinceLastEmail,
  };
}

export function buildPortfolioInsight(leads: Lead[], now = new Date()): PortfolioInsight {
  let projectedViewings = 0;
  let highPriorityCount = 0;
  let slaRiskCount = 0;

  for (const lead of leads) {
    const insight = buildLeadInsight(lead, now);
    if (insight.urgency === 'Critical' || insight.urgency === 'High') highPriorityCount += 1;
    if (insight.slaRisk) slaRiskCount += 1;
    if (lead.pipelineStatus === 'Closed' || lead.pipelineStatus === 'Unqualified') continue;

    if (lead.tier === 'Hot') projectedViewings += 0.25;
    else if (lead.tier === 'Warm') projectedViewings += 0.12;
    else projectedViewings += 0.04;

    if (lead.pipelineStatus === 'Interested') projectedViewings += 0.1;
  }

  return {
    projectedViewings30d: toOneDecimal(projectedViewings),
    highPriorityCount,
    slaRiskCount,
  };
}
