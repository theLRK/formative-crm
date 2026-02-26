# DATA_MODEL.md

- Project: Formative CRM
- Version: 1.0
- Last Updated: 2026-02-26
- Scope: Single-agent MVP

This document is the canonical Airtable data contract for implementation.

## 1. Design Rules

1. Every table stores `id`, `created_at`, and `updated_at`.
2. `id` is application-generated UUID.
3. No hard delete for business records (`leads`, `emails`, `logs`).
4. Email-based lead dedupe is strict and returns `409` on webhook duplicates.
5. Score fields are numeric with one-decimal precision semantics.

## 2. Tables

## 2.1 `users`

Purpose: Admin authentication.

Fields:
- `id` (text, required, unique key)
- `email` (email/text, required, unique)
- `password_hash` (text, required)
- `role` (single select: `admin`, required, default `admin`)
- `is_active` (checkbox, required, default true)
- `created_at` (date-time, required)
- `updated_at` (date-time, required)

Indexes (logical):
- `email` unique lookup

## 2.2 `sessions`

Purpose: Refresh-token session store.

Fields:
- `id` (text, required, unique key)
- `user_id` (text, required)
- `refresh_token` (text, required, unique)
- `expires_at` (date-time, required)
- `created_at` (date-time, required)
- `updated_at` (date-time, required)

Indexes (logical):
- `refresh_token` unique lookup
- `user_id` lookup

## 2.3 `leads`

Purpose: Lead profile + score state + pipeline state.

Fields:
- `id` (text, required, unique key)
- `full_name` (text, required)
- `email` (email/text, required, unique for webhook ingestion)
- `phone` (text, optional)
- `budget` (number, optional)
- `form_score` (number, required, default `0`)
- `interaction_score` (number, required, default `0`)
- `total_score` (number, required, default `0`)
- `tier` (single select: `Hot|Warm|Cold`, required, default `Cold`)
- `pipeline_status` (single select: `New|Contacted|Interested|Question|Objection|Unqualified|Closed`, required, default `New`)
- `thread_id` (text, optional)
- `last_email_sent_at` (date-time, optional)
- `created_at` (date-time, required)
- `updated_at` (date-time, required)

Indexes (logical):
- `email`
- `pipeline_status`
- `total_score`
- `interaction_score`

## 2.4 `emails`

Purpose: Inbound/outbound/draft message history.

Fields:
- `id` (text, required, unique key)
- `lead_id` (text, required)
- `gmail_message_id` (text, optional, unique when present)
- `thread_id` (text, required)
- `direction` (single select: `Inbound|Outbound|Draft`, required)
- `subject` (text, optional)
- `body` (long text, required, max 10,000 chars in API validation)
- `draft_status` (single select: `PendingApproval|Sent|NeedsReview`, optional)
- `sent_at` (date-time, optional)
- `created_at` (date-time, required)
- `updated_at` (date-time, required)

Indexes (logical):
- `lead_id`
- `gmail_message_id`
- `thread_id`
- `draft_status`

## 2.5 `logs`

Purpose: Audit trail + error/event logging.

Fields:
- `id` (text, required, unique key)
- `level` (single select: `info|warn|error`, required)
- `message` (long text, required)
- `metadata` (long text/json-serialized, optional)
- `created_at` (date-time, required)
- `updated_at` (date-time, required)

Indexes (logical):
- `level`
- `created_at`

## 3. Relationship Model (Logical)

1. `users (1) -> (many) sessions` via `sessions.user_id`.
2. `leads (1) -> (many) emails` via `emails.lead_id`.
3. `logs` is independent append-only event storage.

## 4. Integrity Constraints

1. `leads.email` duplicate during webhook ingestion is rejected.
2. `emails.gmail_message_id` dedupes inbound processing.
3. Outbound replies require matching `thread_id` with lead active thread.
4. Draft send path requires `emails.direction=Draft` and `draft_status=PendingApproval`.

## 5. Migration and Backup

1. MVP schema changes are manual in Airtable and must update this file.
2. Weekly Airtable export backup.
3. Retention: 30 days.

