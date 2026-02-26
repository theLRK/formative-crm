# Application Flow Documentation

- Project: Formative CRM
- Version: 1.0
- Last Updated: 2026-02

This document defines Stage 3 behavior for the single-agent MVP. It is explicit by design to remove ambiguity in implementation.

## 1. Entry Points

### Primary Entry Points

#### 1. Typeform Submission (Lead Entry)

- Trigger: A lead submits the Typeform.
- System Actions:
  1. Typeform sends webhook payload to backend.
  2. Backend validates payload and required fields.
  3. Backend computes `FormScore` and lead `Tier` (`Hot`, `Warm`, `Cold`).
  4. Backend writes lead to Airtable.
  5. Backend sends initial outreach email through Gmail API.

This is the primary growth entry point.

#### 2. Gmail Reply (Inbound Engagement)

- Trigger: A lead replies to outreach email.
- System Actions:
  1. Polling job runs every 5 minutes.
  2. System checks Gmail for new inbound messages.
  3. New messages are deduplicated and processed.
  4. `InteractionScore` and `TotalScore` are recalculated.
  5. Draft reply is generated for approval.

#### 3. Admin Dashboard Login

- Trigger: Agent opens admin URL.
- Access: Authenticated only.
- Purpose: Review leads, approve drafts, and monitor pipeline.

### Secondary Entry Points

#### 1. Direct URL Access

- `/admin/login`
- `/admin/dashboard`
- `/admin/leads/:id`

#### 2. Deep Link from Notification Email (Future Enhancement)

- Example: "Draft Ready for Approval"
- Redirect target: `/admin/leads/:id`
- Stage Status: Link target supported in routing, outbound notification sending is not in current MVP scope.

## 2. Core User Flows

### Flow 1: Lead Submission and Initial Outreach

- Goal: Capture and qualify new lead automatically.
- Entry Point: Typeform submission.
- Frequency: Continuous.

#### Happy Path

1. External: Typeform
   - Lead submits required fields (including name, email, budget, property intent).
2. System: Webhook received
   - Validate required fields and formats.
   - Validate idempotency key.
3. System: Duplicate check
   - If email already exists, return HTTP `409` and stop.
4. System: Deterministic scoring
   - Compute `FormScore`.
   - Assign `Tier` as `Hot`, `Warm`, or `Cold`.
5. System: Airtable write
   - Create Lead record.
   - Set `PipelineStatus = New`.
   - Store `FormScore`.
   - Set `LastEmailSentAt = null`.
6. System: Email generation and send
   - Generate contextual first outreach.
   - Send via Gmail API.
7. System: Message logging
   - Store outbound `message_id`, `thread_id`, direction, and timestamp.
   - Update lead:
     - `PipelineStatus = Contacted`
     - `LastEmailSentAt = now`

#### Success State

- Lead is stored.
- First email is sent.
- `thread_id` is recorded.

#### Error States

- Invalid webhook payload:
  - Log validation error.
  - Return HTTP `400`.
  - Do not write lead.
- Airtable failure:
  - Retry up to 3 times.
  - If all retries fail, log critical error.
- Gmail send failure:
  - Retry once.
  - If retry fails, mark lead event/status as `EmailFailed`.

#### Edge Cases

- Duplicate submission by existing email:
  - Return HTTP `409`.
  - No new lead record created.
- Partial submission:
  - Reject and log.

#### Exit Points

- Success: Lead exists in CRM with `PipelineStatus = Contacted`.
- Failure: Request is logged for admin review.

### Flow 2: Inbound Email Processing and Draft Generation

- Goal: Detect reply, score engagement, and prepare intelligent response.
- Entry Point: Scheduled polling job.
- Frequency: Every 5 minutes.

#### Happy Path

1. System: Poll Gmail
   - Query inbound messages newer than last successful poll timestamp.
2. System: Parse message
   - Extract `message_id`, `thread_id`, sender email, body, and timestamp.
3. System: Duplicate check
   - If `message_id` already exists in data store, ignore message.
4. System: Lead and thread validation
   - Match sender email to lead.
   - Confirm `thread_id` matches the lead's active thread.
5. System: Email cleaning
   - Remove quoted text and signature blocks.
   - Extract clean reply body.
6. System: Interaction scoring
   - Compute speed, depth, intent, and sentiment components.
   - Recalculate `InteractionScore`.
   - Recalculate `TotalScore` per scoring spec.
   - Update `Tier` if threshold boundaries are crossed.
7. System: Pipeline update
   - Update `PipelineStatus` based on rules:
     - `Interested`
     - `Question`
     - `Objection`
     - `Unqualified`
8. System: Draft generation
   - Generate reply draft with AI.
   - Store in Emails table with:
     - `Direction = Draft`
     - `DraftStatus = PendingApproval`

#### Success State

- Draft is ready for agent approval.

#### Error States

- No matching lead:
  - Log unmatched email.
  - Flag for manual linking.
- Thread mismatch:
  - Flag as `ThreadConflict`.
  - Do not auto-reply.
- AI scoring or generation failure:
  - Store inbound message.
  - Mark draft/message as `NeedsReview`.
  - Skip automatic draft action for send path.

#### Edge Cases

- Multiple replies before next poll:
  - Process in chronological order.
- Reply from different sender email:
  - Flag for manual review.
- Empty message body:
  - Ignore and log event.

#### Exit Points

- Success: Draft ready in `PendingApproval`.
- Flagged: Await admin action.

### Flow 3: Draft Approval and Sending

- Goal: Agent reviews AI reply before sending.
- Entry Point: Admin dashboard lead detail view.

#### Happy Path

1. Page load: Lead detail
   - Display lead metadata, score breakdown, conversation timeline, and draft editor.
2. Agent action
   - Optional edit.
   - Click "Approve and Send."
3. System execution
   - Validate draft status is `PendingApproval`.
   - Validate `thread_id` for continuity.
   - Send reply in same Gmail thread.
   - Store outbound email record.
   - Update lead `LastEmailSentAt = now`.
   - Update draft `DraftStatus = Sent`.

#### Success State

- Reply is sent in same thread and tracked.

#### Error States

- Gmail send failure:
  - Show inline error.
  - Keep draft editable and intact.
- Session expired:
  - Redirect to `/admin/login`.
  - Preserve draft content state when possible.

## 3. Navigation Map

```text
Admin
├── Login
├── Dashboard
│   ├── Lead List
│   │   └── Lead Detail
│   │       ├── Conversation Timeline
│   │       ├── Score Panel
│   │       └── Draft Editor
│   ├── Filters
│   └── Settings
└── Error Logs
```

### Navigation Rules

- Authentication required for all admin routes except `/admin/login`.
- If not authenticated, redirect to `/admin/login`.
- Back button preserves active filter state.
- Draft edits auto-save every 10 seconds.

## 4. Screen Inventory

### Screen: Admin Login

- Route: `/admin/login`
- Access: Public
- Purpose: Authenticate agent
- States:
  - Loading
  - Invalid credentials
  - Success redirect

### Screen: Dashboard

- Route: `/admin/dashboard`
- Access: Authenticated
- Purpose: Lead overview and triage
- Key Elements:
  - Lead table
  - Status filter
  - Search bar
- States:
  - Empty
  - Loading
  - Error
  - Populated

### Screen: Lead Detail

- Route: `/admin/leads/:id`
- Access: Authenticated
- Purpose: Manage one lead end to end
- Key Elements:
  - Lead metadata
  - Score breakdown (`FormScore`, `InteractionScore`, `TotalScore`)
  - Conversation timeline
  - Draft editor
- Actions:
  - Approve and Send
  - Edit draft
  - Mark closed

## 5. Decision Points

### Authentication Gate

- IF user is not authenticated
  - THEN redirect to `/admin/login`
- ELSE allow route access

### Duplicate Inbound Email

- IF `message_id` already exists
  - THEN ignore message
- ELSE process message

### Tier Evaluation (Lead Priority)

- Tier derives from score thresholds defined in the Internal Scoring Specification Document:
  - `Hot`
  - `Warm`
  - `Cold`

### Pipeline Status Update

- IF reply shows clear purchase intent
  - THEN `PipelineStatus = Interested`
- ELSE IF message is a question
  - THEN `PipelineStatus = Question`
- ELSE IF message indicates objection
  - THEN `PipelineStatus = Objection`
- ELSE IF lead cannot proceed
  - THEN `PipelineStatus = Unqualified`
- ELSE maintain current status

## 6. Error Handling

### 404

- Show simple "Page not found."
- Provide link to `/admin/dashboard`.

### 500

- Show "Something went wrong."
- Log technical error.
- Provide retry action.

### Gmail API Timeout

- Retry once.
- If retry fails, mark operation event/state as `EmailSendFailed`.

## 7. Responsive Behavior

### Mobile

- Collapsible lead cards.
- Full-screen draft editor.
- Sticky send button.

### Desktop

- Split view:
  - Left: conversation timeline
  - Right: draft editor
- Filters visible inline.

## 8. Animations and Transitions

- Page navigation transition: 250ms fade.
- Draft auto-save indicator: subtle checkmark.
- Status badge updates: smooth transition.
