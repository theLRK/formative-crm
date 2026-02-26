import type { Tier } from '@/types/domain';

export interface FormScoreInput {
  budget: number | null;
  purchaseTimeline: 'immediate' | 'one_to_three_months' | 'three_to_six_months' | 'six_plus_months' | 'browsing';
  paymentReadiness: 'cash_ready' | 'mortgage_pre_approved' | 'mortgage_planning' | 'not_specified';
  locationMatch: 'core_area' | 'nearby_area' | 'outside_target' | 'not_specified';
  propertyTypeSpecificity: 'specific' | 'broad' | 'not_specified';
}

export interface InteractionScoreInput {
  lastEmailSentAt: Date | null;
  replyReceivedAt: Date | null;
  messageBody: string;
  replyCountInThread: number;
}

export interface ScoringConfig {
  premiumBudgetThreshold: number;
  midTierBudgetThreshold: number;
  entryTierBudgetThreshold: number;
}

const HIGH_INTENT_KEYWORDS = [
  'schedule viewing',
  'book viewing',
  'ready to buy',
  'cash ready',
  'when can we meet',
];

const MEDIUM_INTENT_KEYWORDS = ['interested', 'tell me more', 'available', 'price negotiable'];
const LOW_INTENT_KEYWORDS = ['still considering', 'maybe later', 'just checking'];

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function capAtHundred(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function countWords(input: string): number {
  if (!input.trim()) return 0;
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function normalizeScoringConfig(input: Partial<ScoringConfig> & { premiumBudgetThreshold: number }): ScoringConfig {
  const premium = input.premiumBudgetThreshold;
  const mid = input.midTierBudgetThreshold ?? Math.round(premium * 0.6);
  const entry = input.entryTierBudgetThreshold ?? Math.round(mid * 0.5);
  return {
    premiumBudgetThreshold: premium,
    midTierBudgetThreshold: mid,
    entryTierBudgetThreshold: entry,
  };
}

export function computeBudgetScore(budget: number | null, config: ScoringConfig): number {
  if (budget === null || Number.isNaN(budget) || budget <= 0) return 0;
  if (budget >= config.premiumBudgetThreshold) return 30;
  if (budget >= config.midTierBudgetThreshold) return 20;
  if (budget >= config.entryTierBudgetThreshold) return 10;
  return 0;
}

export function computeTimelineScore(input: FormScoreInput['purchaseTimeline']): number {
  switch (input) {
    case 'immediate':
      return 25;
    case 'one_to_three_months':
      return 18;
    case 'three_to_six_months':
      return 10;
    case 'six_plus_months':
      return 5;
    default:
      return 0;
  }
}

export function computePaymentScore(input: FormScoreInput['paymentReadiness']): number {
  switch (input) {
    case 'cash_ready':
      return 20;
    case 'mortgage_pre_approved':
      return 15;
    case 'mortgage_planning':
      return 8;
    default:
      return 0;
  }
}

export function computeLocationScore(input: FormScoreInput['locationMatch']): number {
  switch (input) {
    case 'core_area':
      return 15;
    case 'nearby_area':
      return 10;
    case 'outside_target':
      return 5;
    default:
      return 0;
  }
}

export function computePropertyTypeScore(input: FormScoreInput['propertyTypeSpecificity']): number {
  switch (input) {
    case 'specific':
      return 10;
    case 'broad':
      return 5;
    default:
      return 0;
  }
}

export function computeFormScore(input: FormScoreInput, config: ScoringConfig): number {
  const total =
    computeBudgetScore(input.budget, config) +
    computeTimelineScore(input.purchaseTimeline) +
    computePaymentScore(input.paymentReadiness) +
    computeLocationScore(input.locationMatch) +
    computePropertyTypeScore(input.propertyTypeSpecificity);
  return roundToOneDecimal(capAtHundred(total));
}

export function computeReplySpeedScore(input: InteractionScoreInput): number {
  if (!input.lastEmailSentAt || !input.replyReceivedAt) return 0;
  const diffMs = input.replyReceivedAt.getTime() - input.lastEmailSentAt.getTime();
  if (diffMs < 0) return 0;
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 6) return 30;
  if (diffHours <= 24) return 20;
  if (diffHours <= 72) return 10;
  return 5;
}

export function computeIntentScore(messageBody: string): number {
  const body = toCaseInsensitive(messageBody);
  if (!body) return 0;
  if (HIGH_INTENT_KEYWORDS.some((keyword) => body.includes(keyword))) return 40;
  if (MEDIUM_INTENT_KEYWORDS.some((keyword) => body.includes(keyword))) return 25;
  if (LOW_INTENT_KEYWORDS.some((keyword) => body.includes(keyword))) return 10;
  return 0;
}

export function computeLengthScore(messageBody: string): number {
  const words = countWords(messageBody);
  if (words >= 50) return 15;
  if (words >= 20) return 10;
  if (words >= 5) return 5;
  return 0;
}

export function computeFollowUpScore(replyCountInThread: number): number {
  if (replyCountInThread >= 3) return 15;
  if (replyCountInThread === 2) return 10;
  if (replyCountInThread === 1) return 5;
  return 0;
}

export function computeInteractionScore(input: InteractionScoreInput): number {
  const total =
    computeReplySpeedScore(input) +
    computeIntentScore(input.messageBody) +
    computeLengthScore(input.messageBody) +
    computeFollowUpScore(input.replyCountInThread);
  return roundToOneDecimal(capAtHundred(total));
}

export function computeTotalScore(formScore: number, interactionScore: number): number {
  const total = formScore * 0.6 + interactionScore * 0.4;
  return roundToOneDecimal(capAtHundred(total));
}

export function computeTier(totalScore: number): Tier {
  if (totalScore >= 75) return 'Hot';
  if (totalScore >= 50) return 'Warm';
  return 'Cold';
}

export function toCaseInsensitive(input: string): string {
  return input.toLowerCase().trim();
}
