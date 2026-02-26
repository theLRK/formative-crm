# IMPLEMENTATION_DECISIONS.md

- Project: Formative CRM
- Version: 1.0 (MVP Contract Freeze)
- Last Updated: 2026-02-25
- Owner: Samuel / Implementation Team

## Purpose

This document is the implementation source of truth when any existing document conflicts.
Priority order for implementation:

1. `IMPLEMENTATION_DECISIONS.md` (this file)
2. `SCORING_SPEC.md`
3. `BACKEND_STRUCTURE.md`
4. `02-application-flow.md`
5. `01-prd.md`
6. `TECH_STACK.md`
7. `FRONTEND_GUIDELINES.md`

## Locked MVP Scope

1. Single-agent CRM only.
2. No multi-agent or multi-agency support.
3. No WhatsApp, SMS, or auto-send without approval.
4. No payment flow, no rentals scope, no native mobile app.

## Locked Domain Contracts

### Lead and Submission Rules

1. Typeform webhook endpoint: `POST /api/v1/leads/webhook`.
2. All 9 intake fields are required.
3. Duplicate lead by email returns HTTP `409` (reject, no upsert).
4. Idempotency key is required and enforced.
5. Lead record must be written before first outbound email send.

### Scoring Contracts

1. Scoring is deterministic, formula-based, and stateless.
2. Formula lock:
   - `TotalScore = (0.6 * FormScore) + (0.4 * InteractionScore)`
3. Round all scores to one decimal place.
4. Tier thresholds (inclusive):
   - `Hot`: `75.0 - 100`
   - `Warm`: `50.0 - 74.9`
   - `Cold`: `0.0 - 49.9`
5. No AI weighting in scoring logic.
6. Keyword matching is case-insensitive.
7. Missing category data yields zero points for that category.

### Email and Threading Contracts

1. First outreach is sent via Gmail API after lead creation.
2. Persist both `message_id` and `thread_id` for every relevant message.
3. Outbound replies must stay in the same Gmail thread.
4. Inbound message dedupe is keyed by `message_id`.
5. Thread mismatch is flagged (`ThreadConflict`) and blocked from auto send.

### Draft Workflow Contracts

1. AI-generated replies are drafts only.
2. Draft must be `PendingApproval` before send.
3. Agent approval is mandatory before outbound reply.
4. Successful send updates draft status to `Sent`.

## Locked Enums

### Tier

- `Hot`
- `Warm`
- `Cold`

### PipelineStatus

- `New`
- `Contacted`
- `Interested`
- `Question`
- `Objection`
- `Unqualified`
- `Closed`

### DraftStatus

- `PendingApproval`
- `Sent`
- `NeedsReview`

### EmailDirection

- `Inbound`
- `Outbound`
- `Draft`

## Locked Technical Decisions

1. Runtime/app framework: Next.js 14 + TypeScript.
2. Backend pattern: Next.js API routes under `/api/v1`.
3. Primary datastore: Airtable.
4. Polling cadence: fixed every 5 minutes.
5. AI provider default: OpenAI.
6. Hosting target: Vercel.

## Security and Access Decisions

1. Admin-only auth for MVP.
2. Access token: JWT (24h expiry).
3. Refresh token persisted in `sessions`.
4. Protected routes require bearer token.
5. Password policy:
   - minimum 8 chars
   - at least 1 uppercase
   - at least 1 number
   - bcrypt (12 rounds)
6. Poll endpoint requires `CRON_SECRET`.

## Conflict Resolutions (Locked)

1. Product naming:
   - Canonical name is `Formative CRM`.
2. Duplicate lead behavior:
   - Reject with `409`; never auto-update existing lead on webhook duplicate.
3. Poll interval:
   - Fixed 5 minutes for MVP.
4. Auth implementation conflict (`TECH_STACK.md` vs backend contracts):
   - MVP auth implementation follows `BACKEND_STRUCTURE.md` contract:
     custom `/api/v1/auth/login|refresh|logout` with JWT + refresh tokens.
   - `next-auth` may remain as a dependency placeholder but is not the active auth contract for MVP.
5. Scoring reference-value conflict (`98.9`, `85.5`):
   - Implementation release gate uses deterministic formula, rounding, category rules, and threshold tests from `SCORING_SPEC.md`.
   - Reference vectors `98.9` and `85.5` are retained as documented calibration targets and will be validated after fixture inputs are finalized in code-level test fixtures.

## Phase 1 Exit Criteria

Phase 1 is complete when:

1. This document is approved as implementation source of truth.
2. All new engineering tickets reference this file for contract decisions.
3. No feature work starts without using the locked enums and rules above.
