# Product Requirements Document (PRD)

## 1. Product Overview

- Project Title: AI Real Estate CRM
- CRM Name: Formative CRM
- Version: 1.0
- Last Updated: 2026-02-21
- Owner: Samuel

## 2. Problem Statement

Premium real estate agents in Lekki and Victoria Island lose high-intent buyers due to slow response times, poor lead qualification, and disorganized follow-up.

Manual lead tracking creates three core problems:

1. No structured lead scoring to prioritize serious buyers.
2. Delayed email responses reduce conversion probability.
3. No visibility into conversation momentum.

Formative CRM solves these issues through structured qualification, automated first contact, and intelligent follow-up tracking while keeping the agent in control.

## 3. Goals and Objectives

### Business Goals

- Reduce first response time to under 5 minutes for 90% of new leads within 3 months.
- Achieve a viewing scheduling rate of at least 25% for Hot leads within 60 days.
- Reduce manual follow-up workload by 40% within the first 90 days.

### User Goals

- Identify serious buyers quickly.
- Automatically send curated property matches.
- Maintain clean and consistent email threads.
- Track conversation quality using measurable scores.
- Approve AI-generated replies before sending.

## 4. Success Metrics

- First Response Time: Under 5 minutes for 90% of new leads.
- Hot Lead Conversion Rate: Minimum 25% schedule a viewing.
- Draft Approval Time: Under 24 hours for 95% of drafts.
- Duplicate Lead Rate: Less than 1%.
- Email Thread Continuity: 100% of replies remain in the original Gmail thread.

## 5. Target Users and Personas

### Primary Persona: Lagos Property Agent (Single-Agent MVP)

- Demographics: 28 to 45 years old, works in Lekki or Victoria Island.
- Pain Points:
  - Too many low-quality inquiries.
  - Missed follow-ups.
  - No structured scoring.
- Goals:
  - Prioritize serious buyers.
  - Automate initial communication.
  - Maintain a professional image.
- Technical Proficiency:
  - Comfortable with email and CRM dashboards.
  - Not a developer.

### Secondary Persona: Property Buyer

- Demographics: 30 to 55 years old, mid to high income.
- Pain Points:
  - Slow agent responses.
  - Irrelevant listings.
- Goals:
  - Receive curated property options quickly.
  - Schedule viewings efficiently.
- Technical Proficiency:
  - Comfortable with online forms and email.

## 6. Features and Requirements

### Must-Have Features (P0)

#### 1. Lead Capture Integration

- Description: Accept Typeform submissions and process them into CRM records.
- User Story: As an agent, I want every form submission to be automatically stored and scored so that I can prioritize serious buyers.
- Acceptance Criteria:
  - [ ] All 9 form fields are required.
  - [ ] Duplicate email returns HTTP `409`.
  - [ ] `FormScore` is calculated exactly according to the scoring formula.
  - [ ] Lead record is created in Airtable before email sending starts.
  - [ ] Idempotency key prevents double submission.
- Success Metric: 100% of valid submissions are stored successfully.

#### 2. Deterministic Scoring Engine

- Description: Calculate `FormScore`, `InteractionScore`, and `TotalScore` using fixed formulas.
- User Story: As an agent, I want leads automatically labeled Hot, Warm, or Cold so that I know who to contact first.
- Acceptance Criteria:
  - [ ] `FormScore` test case equals 98.9.
  - [ ] `InteractionScore` test case equals 85.5.
  - [ ] `TotalScore` uses 0.6 and 0.4 weighting.
  - [ ] Lead label auto-updates based on score range (`Hot`, `Warm`, `Cold`).
- Success Metric: 100% scoring accuracy in approved test cases.
- Note: Exact formulas and test vectors are maintained in the Internal Scoring Specification Document.

#### 3. Gmail Auto Send

- Description: Send the first outreach email automatically after lead creation.
- User Story: As an agent, I want new leads to receive property matches immediately so that response time is minimized.
- Acceptance Criteria:
  - [ ] Email sent via Gmail API.
  - [ ] `thread_id` stored.
  - [ ] `message_id` stored.
  - [ ] Lead updated with `LastEmailSentAt`.
- Success Metric: 95% send success rate.

#### 4. Scheduled Reply Detection

- Description: Poll Gmail every 2 to 5 minutes to detect inbound replies.
- User Story: As an agent, I want replies automatically analyzed so that I know how serious the buyer is.
- Acceptance Criteria:
  - [ ] `message_id` deduplication enforced.
  - [ ] `InteractionScore` updated on reply.
  - [ ] Inbound email stored.
  - [ ] AI draft created with `PendingApproval` status.
- Success Metric: 100% reply detection accuracy.

#### 5. Draft Approval Workflow

- Description: Agent must approve AI-generated replies before sending.
- User Story: As an agent, I want control over outgoing communication so that nothing is sent automatically.
- Acceptance Criteria:
  - [ ] Draft status must equal `PendingApproval`.
  - [ ] Approve endpoint validates `thread_id`.
  - [ ] Reply sent in the same Gmail thread.
  - [ ] Draft status updated to `Sent`.
- Success Metric: 100% thread continuity.

### Should-Have Features (P1)

- KPI dashboard with Hot lead count.
- Sortable lead table.
- Lead detail view with score breakdown.
- Inline stage editing.
- Bulk archive option.

### Nice-to-Have Features (P2)

- Automated follow-up reminders.
- Analytics export.
- Multi-agent support (post-MVP only).

## 7. Explicitly Out of Scope

- SMS sending.
- WhatsApp automation.
- Auto-sending replies without approval.
- Payment processing.
- Property listing marketplace.
- Multi-agency support.
- Native mobile app.
- Machine learning weight optimization.
- Voice call automation.
- CRM for rentals.
- Multi-agent production workflows in MVP.

## 8. User Scenarios

### Scenario 1: New High-Intent Lead

- Context: Buyer submits form indicating immediate purchase and cash readiness.
- Steps:
  1. Buyer fills Typeform.
  2. Backend calculates `FormScore`.
  3. Lead is saved in Airtable.
  4. Initial email is sent.
  5. Lead label is set to `Hot`.
- Expected Outcome: Lead appears as `Hot` in dashboard within 30 seconds.
- Edge Cases:
  - Duplicate email submission.
  - Gmail send failure.

### Scenario 2: Buyer Replies Within 6 Hours

- Context: Buyer replies with "Schedule viewing this week."
- Steps:
  1. Polling job detects reply.
  2. `InteractionScore` is calculated.
  3. Draft reply is generated.
  4. Agent approves draft.
  5. Reply is sent in the same thread.
- Expected Outcome: `TotalScore` increases and conversation remains in one Gmail thread.
- Edge Cases:
  - Email already processed.
  - Thread mismatch.

### Scenario 3: Low-Intent Buyer

- Context: Buyer replies with "Still considering."
- Steps:
  1. Reply is detected.
  2. Lower intent score is assigned.
  3. Draft suggests delayed follow-up.
  4. Lead label updates to `Warm`.
- Expected Outcome: Agent sees reduced priority and can sequence follow-up accordingly.

## 9. Dependencies and Constraints

### Technical Constraints

- Gmail API quota and rate limits.
- Airtable API rate limits.

### Business Constraints

- Single-agent usage for MVP.
- Limited initial budget.

### External Dependencies

- Typeform
- Airtable
- Gmail API
- OpenAI API (default for MVP)

Note: Provider abstraction for Gemini/OpenRouter is a post-MVP enhancement.

## 10. Timeline and Milestones

### MVP Scope

- Lead capture
- Scoring engine
- Gmail auto-send
- Polling reply detection
- Draft approval

### V1.0 Scope

- Full dashboard
- Score transparency
- Bulk archive
- KPI metrics

## 11. Risks and Assumptions

### Risks

- Gmail rate limits.
- Email parsing inaccuracies.
- OAuth token expiration.

### Mitigations

- Retry logic.
- `message_id` dedupe.
- Token refresh automation.

### Assumptions

- Single agent reviews drafts daily.
- Buyers primarily respond via email.

## 12. Non-Functional Requirements

### Performance

- API response time under 500ms.
- Polling interval maximum 5 minutes.

### Security

- OAuth token storage in environment variables.
- No hard delete.
- Duplicate email prevention.

### Accessibility

- Desktop-optimized interface.
- Clear, readable typography.

### Scalability

- Supports up to 5,000 leads without structural redesign.

## 13. References and Resources

- Gmail API documentation
- Airtable API documentation
- Internal Scoring Specification Document
