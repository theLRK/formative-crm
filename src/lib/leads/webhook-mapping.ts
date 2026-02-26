import type { FormScoreInput } from '@/lib/scoring';

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function mapPurchaseTimeline(value: string): FormScoreInput['purchaseTimeline'] {
  const input = normalized(value);
  if (input.includes('immediate') || input.includes('0-1') || input.includes('now')) return 'immediate';
  if (input.includes('1-3')) return 'one_to_three_months';
  if (input.includes('3-6')) return 'three_to_six_months';
  if (input.includes('6+') || input.includes('six') || input.includes('later')) return 'six_plus_months';
  return 'browsing';
}

export function mapPaymentReadiness(value: string): FormScoreInput['paymentReadiness'] {
  const input = normalized(value);
  if (input.includes('cash')) return 'cash_ready';
  if (input.includes('pre') && input.includes('approved')) return 'mortgage_pre_approved';
  if (input.includes('mortgage') && input.includes('planning')) return 'mortgage_planning';
  return 'not_specified';
}

export function mapLocationPreference(value: string): FormScoreInput['locationMatch'] {
  const input = normalized(value);
  if (!input || input.includes('not specified') || input.includes('n/a')) return 'not_specified';
  if (input.includes('lekki') || input.includes('victoria island')) return 'core_area';
  if (
    input.includes('ajah') ||
    input.includes('ikoyi') ||
    input.includes('oniru') ||
    input.includes('chevron') ||
    input.includes('nearby')
  ) {
    return 'nearby_area';
  }
  return 'outside_target';
}

export function mapPropertyTypeSpecificity(value: string): FormScoreInput['propertyTypeSpecificity'] {
  const input = normalized(value);
  if (!input || input.includes('not specified') || input.includes('no preference') || input === 'any') {
    return 'not_specified';
  }
  if (input.includes('broad') || input.includes('all properties') || input.includes('any property')) {
    return 'broad';
  }
  return 'specific';
}

