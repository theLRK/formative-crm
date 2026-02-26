import { normalizeLeadWebhookPayload } from '../../src/lib/leads/typeform-webhook';

function buildTypeformPayload() {
  return {
    event_id: 'evt_abc123456',
    form_response: {
      token: 'resp_tok_12345678',
      answers: [
        {
          type: 'short_text',
          text: 'Samuel Agent',
          field: { id: 'BO8x5fgg8RwC', ref: '06ea7c11-8020-40ac-96c0-31a0f69e3036' },
        },
        {
          type: 'email',
          email: 'lead@example.com',
          field: { id: 'pnostcMC0Mr7', ref: '6af29353-48e7-46f3-b851-d45406107c28' },
        },
        {
          type: 'phone_number',
          phone_number: '+2348012345678',
          field: { id: 'vUeplXz7YLhp', ref: 'd19f6562-f02c-479c-8c12-1a496d2f4e58' },
        },
        {
          type: 'number',
          number: 150000000,
          field: { id: 'qFSeII9JilJ6', ref: 'd8ba6dd1-b292-45f9-92c0-f2b3251f90ac' },
        },
        {
          type: 'short_text',
          text: 'Lekki',
          field: { id: 'IBIFQdG2L4Im', ref: '20454b3e-3f39-4e7b-b1ca-d35a12715f92' },
        },
        {
          type: 'choice',
          choice: { label: 'Immediately' },
          field: { id: 'dngu5AG5UOVz', ref: '4215cc7f-de11-4c90-890a-c3f37acb2874' },
        },
        {
          type: 'choice',
          choice: { label: 'Cash' },
          field: { id: 'c28I66aZgVW9', ref: '6d3e06f9-4dbe-4f4a-89ca-747283dfc321' },
        },
        {
          type: 'choice',
          choice: { label: 'Condo' },
          field: { id: 'hhKBfK5tA7yh', ref: 'cecb112a-93f1-4fc1-9e9e-052c24699f43' },
        },
        {
          type: 'long_text',
          text: 'I need a new property with close proximity to business district.',
          field: { id: '98mlxEIINyVc', ref: '6693957e-ce20-48b5-819e-e9253c01933b' },
        },
      ],
    },
  };
}

describe('normalizeLeadWebhookPayload', () => {
  it('maps native Typeform webhook answers to internal lead payload', () => {
    const normalized = normalizeLeadWebhookPayload(buildTypeformPayload(), {
      headerIdempotencyKey: 'header-should-not-win',
    });

    expect(normalized).toMatchObject({
      idempotencyKey: 'resp_tok_12345678',
      fullName: 'Samuel Agent',
      email: 'lead@example.com',
      phone: '+2348012345678',
      budget: 150000000,
      purchaseTimeline: 'Immediately',
      paymentReadiness: 'Cash',
      locationPreference: 'Lekki',
      propertyType: 'Condo',
      message: 'I need a new property with close proximity to business district.',
    });
  });

  it('keeps direct payload fields and adds idempotency from header fallback', () => {
    const directPayload = {
      fullName: 'Direct User',
      email: 'direct@example.com',
      phone: '+2348098765432',
      budget: 200000000,
      purchaseTimeline: 'Immediate (0-1 month)',
      paymentReadiness: 'Cash ready',
      locationPreference: 'Lekki',
      propertyType: '3 bedroom duplex',
      message: 'Need viewing this week',
    };

    const normalized = normalizeLeadWebhookPayload(directPayload, {
      headerIdempotencyKey: 'idem-from-header',
    });

    expect(normalized).toMatchObject({
      ...directPayload,
      idempotencyKey: 'idem-from-header',
    });
  });

  it('uses explicit direct idempotency key over typeform token', () => {
    const payload = {
      ...buildTypeformPayload(),
      idempotencyKey: 'manual-idem-12345678',
    };
    const normalized = normalizeLeadWebhookPayload(payload, {
      headerIdempotencyKey: 'header-fallback',
    });

    expect(normalized.idempotencyKey).toBe('manual-idem-12345678');
  });

  it('falls back to event id when response token is missing', () => {
    const payload = buildTypeformPayload();
    const payloadWithoutToken = {
      ...payload,
      form_response: {
        ...payload.form_response,
        token: undefined,
      },
    };

    const normalized = normalizeLeadWebhookPayload(payloadWithoutToken);
    expect(normalized.idempotencyKey).toBe('evt_abc123456');
  });
});
