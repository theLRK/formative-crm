type GenericRecord = Record<string, unknown>;

interface TypeformAnswer {
  type?: string;
  field?: {
    id?: string;
    ref?: string;
  };
  text?: string;
  email?: string;
  number?: number;
  phone_number?: string;
  choice?: {
    label?: string;
  };
  choices?: {
    labels?: string[];
  };
}

interface TypeformFormResponse {
  token?: string;
  answers?: unknown[];
}

interface TypeformWebhookPayload {
  event_id?: string;
  response_id?: string;
  form_response?: TypeformFormResponse;
}

const TYPEFORM_FIELDS = {
  fullName: {
    refs: ['06ea7c11-8020-40ac-96c0-31a0f69e3036'],
    ids: ['BO8x5fgg8RwC'],
  },
  email: {
    refs: ['6af29353-48e7-46f3-b851-d45406107c28'],
    ids: ['pnostcMC0Mr7'],
  },
  phone: {
    refs: ['d19f6562-f02c-479c-8c12-1a496d2f4e58'],
    ids: ['vUeplXz7YLhp'],
  },
  budget: {
    refs: ['d8ba6dd1-b292-45f9-92c0-f2b3251f90ac'],
    ids: ['qFSeII9JilJ6'],
  },
  locationPreference: {
    refs: ['20454b3e-3f39-4e7b-b1ca-d35a12715f92'],
    ids: ['IBIFQdG2L4Im'],
  },
  purchaseTimeline: {
    refs: ['4215cc7f-de11-4c90-890a-c3f37acb2874'],
    ids: ['dngu5AG5UOVz'],
  },
  paymentReadiness: {
    refs: ['6d3e06f9-4dbe-4f4a-89ca-747283dfc321'],
    ids: ['c28I66aZgVW9'],
  },
  propertyType: {
    refs: ['cecb112a-93f1-4fc1-9e9e-052c24699f43'],
    ids: ['hhKBfK5tA7yh'],
  },
  message: {
    refs: ['6693957e-ce20-48b5-819e-e9253c01933b'],
    ids: ['98mlxEIINyVc'],
  },
} as const;

function isRecord(input: unknown): input is GenericRecord {
  return typeof input === 'object' && input !== null;
}

function toStringValue(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input.trim();
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);
  return undefined;
}

function toNumberValue(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractAnswerValue(answer: TypeformAnswer): string | number | undefined {
  switch (answer.type) {
    case 'email':
      return toStringValue(answer.email);
    case 'phone_number':
      return toStringValue(answer.phone_number);
    case 'number':
      return toNumberValue(answer.number);
    case 'short_text':
    case 'long_text':
    case 'text':
      return toStringValue(answer.text);
    case 'choice':
    case 'multiple_choice':
      return toStringValue(answer.choice?.label);
    case 'choices': {
      const labels = answer.choices?.labels ?? [];
      if (!Array.isArray(labels)) return undefined;
      const safeLabels = labels.filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
      return safeLabels.length > 0 ? safeLabels.join(', ') : undefined;
    }
    default:
      return (
        toStringValue(answer.text) ??
        toStringValue(answer.email) ??
        toStringValue(answer.phone_number) ??
        toNumberValue(answer.number) ??
        toStringValue(answer.choice?.label)
      );
  }
}

function findAnswerValue(
  answersByRef: Map<string, string | number>,
  answersById: Map<string, string | number>,
  lookup: { refs: readonly string[]; ids: readonly string[] },
): string | number | undefined {
  for (const ref of lookup.refs) {
    const value = answersByRef.get(ref);
    if (value !== undefined) return value;
  }
  for (const id of lookup.ids) {
    const value = answersById.get(id);
    if (value !== undefined) return value;
  }
  return undefined;
}

function mapTypeformPayload(rawPayload: TypeformWebhookPayload): Partial<{
  idempotencyKey: string;
  fullName: string;
  email: string;
  phone: string;
  budget: number;
  purchaseTimeline: string;
  paymentReadiness: string;
  locationPreference: string;
  propertyType: string;
  message: string;
}> {
  const answers = rawPayload.form_response?.answers;
  if (!Array.isArray(answers)) return {};

  const answersByRef = new Map<string, string | number>();
  const answersById = new Map<string, string | number>();

  for (const candidate of answers) {
    if (!isRecord(candidate)) continue;
    const answer = candidate as TypeformAnswer;
    const value = extractAnswerValue(answer);
    if (value === undefined) continue;

    if (answer.field?.ref) answersByRef.set(answer.field.ref, value);
    if (answer.field?.id) answersById.set(answer.field.id, value);
  }

  const mapped: Partial<{
    idempotencyKey: string;
    fullName: string;
    email: string;
    phone: string;
    budget: number;
    purchaseTimeline: string;
    paymentReadiness: string;
    locationPreference: string;
    propertyType: string;
    message: string;
  }> = {};

  const fullName = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.fullName);
  const email = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.email);
  const phone = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.phone);
  const budget = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.budget);
  const purchaseTimeline = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.purchaseTimeline);
  const paymentReadiness = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.paymentReadiness);
  const locationPreference = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.locationPreference);
  const propertyType = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.propertyType);
  const message = findAnswerValue(answersByRef, answersById, TYPEFORM_FIELDS.message);

  if (typeof fullName === 'string') mapped.fullName = fullName;
  if (typeof email === 'string') mapped.email = email;
  if (typeof phone === 'string') mapped.phone = phone;
  if (typeof budget === 'number') mapped.budget = budget;
  if (typeof purchaseTimeline === 'string') mapped.purchaseTimeline = purchaseTimeline;
  if (typeof paymentReadiness === 'string') mapped.paymentReadiness = paymentReadiness;
  if (typeof locationPreference === 'string') mapped.locationPreference = locationPreference;
  if (typeof propertyType === 'string') mapped.propertyType = propertyType;
  if (typeof message === 'string') mapped.message = message;

  const typeformIdempotency =
    toStringValue(rawPayload.form_response?.token) ??
    toStringValue(rawPayload.response_id) ??
    toStringValue(rawPayload.event_id);
  if (typeformIdempotency) mapped.idempotencyKey = typeformIdempotency;

  return mapped;
}

export function normalizeLeadWebhookPayload(
  rawPayload: unknown,
  options?: {
    headerIdempotencyKey?: string;
  },
): Record<string, unknown> {
  const headerIdempotencyKey = options?.headerIdempotencyKey;
  if (!isRecord(rawPayload)) {
    return {
      idempotencyKey: headerIdempotencyKey,
    };
  }

  const directPayload = { ...rawPayload };
  const typeformMapped = mapTypeformPayload(rawPayload as TypeformWebhookPayload);

  const normalized: Record<string, unknown> = {
    ...directPayload,
  };

  for (const [key, value] of Object.entries(typeformMapped)) {
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  normalized.idempotencyKey =
    toStringValue(directPayload.idempotencyKey) ??
    toStringValue(typeformMapped.idempotencyKey) ??
    headerIdempotencyKey;

  return normalized;
}
