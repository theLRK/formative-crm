# TYPEFORM_FIELD_MAPPING.md

- Project: Formative CRM
- Date: 2026-02-26
- Typeform Form ID: `CIpCMsBZ`
- Typeform Form Title: `My branded typeform`
- Source Schema Snapshot: `docs/typeform-form-schema.json`

## 1. Locked Intake Contract (Step 1)

The webhook ingestion contract remains the same as `leadWebhookSchema`:

1. `fullName` (required)
2. `email` (required)
3. `phone` (required)
4. `budget` (required, integer > 0)
5. `purchaseTimeline` (required)
6. `paymentReadiness` (required)
7. `locationPreference` (required)
8. `propertyType` (required)
9. `message` (required)

Idempotency source for Typeform webhook events:

- Primary: Typeform `response_id` (from webhook payload)
- Fallback: Typeform event-level ID if `response_id` is unavailable

## 2. Typeform Field Mapping (Step 2)

| CRM Key | Required | Typeform Field ID | Typeform Ref | Typeform Title | Type | Notes/Transform |
|---|---|---|---|---|---|---|
| `fullName` | Yes | `BO8x5fgg8RwC` | `06ea7c11-8020-40ac-96c0-31a0f69e3036` | What is your full name? | `short_text` | direct string |
| `email` | Yes | `pnostcMC0Mr7` | `6af29353-48e7-46f3-b851-d45406107c28` | What's your email address? | `email` | validate email format |
| `phone` | Yes | `vUeplXz7YLhp` | `d19f6562-f02c-479c-8c12-1a496d2f4e58` | What's your phone number? | `phone_number` | direct string |
| `budget` | Yes | `qFSeII9JilJ6` | `d8ba6dd1-b292-45f9-92c0-f2b3251f90ac` | What is your budget? | `number` | coerce to positive integer |
| `locationPreference` | Yes | `IBIFQdG2L4Im` | `20454b3e-3f39-4e7b-b1ca-d35a12715f92` | Which location do you prefer? | `short_text` | mapped in `mapLocationPreference` |
| `purchaseTimeline` | Yes | `dngu5AG5UOVz` | `4215cc7f-de11-4c90-890a-c3f37acb2874` | When would you like to make your purchase? | `multiple_choice` | mapped in `mapPurchaseTimeline` |
| `paymentReadiness` | Yes | `c28I66aZgVW9` | `6d3e06f9-4dbe-4f4a-89ca-747283dfc321` | How will you handle financing or payment? | `multiple_choice` | mapped in `mapPaymentReadiness` |
| `propertyType` | Yes | `hhKBfK5tA7yh` | `cecb112a-93f1-4fc1-9e9e-052c24699f43` | What type of property are you interested in? | `multiple_choice` | mapped in `mapPropertyTypeSpecificity` |
| `message` | Yes | `98mlxEIINyVc` | `6693957e-ce20-48b5-819e-e9253c01933b` | Tell us more about what you want | `long_text` | max 10000 chars |

Non-contract Typeform fields currently ignored by backend:

1. `nxFgI7wgEPhJ` (`statement`) - intro text
2. `aC7AsYbzeK76` (`How many bedrooms do you need?`) - optional future enrichment field

## 3. Immediate Implementation Notes

1. Parse Typeform webhook `answers[]` by `field.ref` (stable mapping key).
2. Build flat payload using the contract keys above.
3. Set `idempotencyKey = response_id`.
4. Validate with `leadWebhookSchema`.
5. Pass into existing `processLeadWebhook` pipeline.