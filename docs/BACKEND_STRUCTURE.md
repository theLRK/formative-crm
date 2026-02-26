# BACKEND_STRUCTURE.md

- Project: Formative CRM
- Context: Web-based CRM that captures leads from Typeform, scores them, stores them, tracks email conversations through Gmail, generates AI drafts, and allows an agent to approve and send replies.
- Scope: Single-agent MVP

Main backend-supported capabilities:

- Lead storage and scoring
- Email thread tracking
- Interaction scoring
- Draft lifecycle management
- Admin authentication
- Activity logging

## 1. Architecture Overview

### Architecture Pattern

- RESTful API
- Versioned endpoints under `/api/v1/`
- Next.js API routes as backend layer
- Airtable as primary datastore
- Gmail API for email threading
- JWT-based authentication

### Authentication Strategy

- Access token: JWT (24-hour expiry)
- Refresh token: stored in database table (`sessions`)
- Role-based access: `admin` only for MVP
- All admin routes require `Authorization: Bearer <token>`

### Data Flow Diagram (Text Description)

1. Lead submits Typeform.
2. Webhook hits `POST /api/v1/leads/webhook`.
3. Lead is validated and stored.
4. `FormScore` is computed.
5. Initial email is sent via Gmail API.
6. Email record is stored with `thread_id`.
7. Polling job calls `POST /api/v1/emails/poll`.
8. New replies are fetched.
9. `InteractionScore` and `TotalScore` are recalculated.
10. Draft is generated and stored as `PendingApproval`.
11. Admin approves via `POST /api/v1/emails/:id/send`.

### Caching Strategy

- MVP: No persistent caching layer.
- Future:
  - Redis for session token lookups
  - Redis for rate-limit counters

## 2. Database Schema

Logical schema below is stored in Airtable tables for MVP.

All tables use:

- `id` UUID primary key
- `created_at` timestamp, default current timestamp
- `updated_at` timestamp, default current timestamp

### Table: `users`

Purpose: Admin authentication and authorization.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | UUID | PRIMARY KEY | Unique user ID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| role | VARCHAR(50) | NOT NULL, DEFAULT `'admin'` | User role |
| is_active | BOOLEAN | NOT NULL, DEFAULT `true` | Account status |
| created_at | TIMESTAMP | NOT NULL | Created time |
| updated_at | TIMESTAMP | NOT NULL | Updated time |

Indexes:

- Primary key on `id`
- Unique index on `email`

### Table: `sessions`

Purpose: Store refresh tokens.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | UUID | PRIMARY KEY | Session ID |
| user_id | UUID | NOT NULL | FK -> `users.id` |
| refresh_token | VARCHAR(500) | NOT NULL, UNIQUE | Refresh token |
| expires_at | TIMESTAMP | NOT NULL | Expiry time |
| created_at | TIMESTAMP | NOT NULL | Created time |
| updated_at | TIMESTAMP | NOT NULL | Updated time |

Relationships:

- `user_id -> users(id)` on delete cascade

### Table: `leads`

Purpose: Store captured leads and scoring state.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | UUID | PRIMARY KEY | Lead ID |
| full_name | VARCHAR(255) | NOT NULL | Lead name |
| email | VARCHAR(255) | NOT NULL | Lead email |
| phone | VARCHAR(50) | NULL | Lead phone |
| budget | INTEGER | NULL | Budget value |
| form_score | DECIMAL(5,2) | NOT NULL, DEFAULT `0` | Form qualification score |
| interaction_score | DECIMAL(5,2) | NOT NULL, DEFAULT `0` | Engagement score |
| total_score | DECIMAL(5,2) | NOT NULL, DEFAULT `0` | Weighted total score |
| tier | VARCHAR(20) | NOT NULL, DEFAULT `'Cold'` | `Hot/Warm/Cold` |
| pipeline_status | VARCHAR(50) | NOT NULL, DEFAULT `'New'` | Workflow status |
| thread_id | VARCHAR(255) | NULL | Gmail thread ID |
| last_email_sent_at | TIMESTAMP | NULL | Last outbound timestamp |
| created_at | TIMESTAMP | NOT NULL | Created time |
| updated_at | TIMESTAMP | NOT NULL | Updated time |

Indexes:

- Index on `email`
- Index on `pipeline_status`
- Index on `total_score`
- Index on `interaction_score`

### Table: `emails`

Purpose: Store outbound, inbound, and draft email records.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | UUID | PRIMARY KEY | Email record ID |
| lead_id | UUID | NOT NULL | FK -> `leads.id` |
| gmail_message_id | VARCHAR(255) | UNIQUE | Gmail message ID |
| thread_id | VARCHAR(255) | NOT NULL | Gmail thread ID |
| direction | VARCHAR(20) | NOT NULL | `Inbound/Outbound/Draft` |
| subject | VARCHAR(255) | NULL | Email subject |
| body | TEXT | NOT NULL | Email body |
| draft_status | VARCHAR(50) | NULL | `PendingApproval/Sent/NeedsReview` |
| sent_at | TIMESTAMP | NULL | Sent timestamp |
| created_at | TIMESTAMP | NOT NULL | Created time |
| updated_at | TIMESTAMP | NOT NULL | Updated time |

Relationships:

- `lead_id -> leads(id)` on delete cascade

### Table: `logs`

Purpose: Store system events and errors.

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PRIMARY KEY |
| level | VARCHAR(50) | NOT NULL |
| message | TEXT | NOT NULL |
| metadata | JSON | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

## 3. API Endpoints

All endpoints are under `/api/v1/`.

### Authentication

#### `POST /api/v1/auth/login`

- Auth: Public
- Request:

```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

- Validation:
  - Email format valid
  - Password minimum 8 characters
- Success `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "token"
  }
}
```

- Errors:
  - `401` invalid credentials
- Side effects:
  - Insert row in `sessions`

#### `POST /api/v1/auth/refresh`

- Auth: Valid refresh token required
- Result: Returns new access token

#### `POST /api/v1/auth/logout`

- Auth: Access token required
- Result: Deletes session row for active refresh token

### Leads

#### `POST /api/v1/leads/webhook`

- Auth: Public (secured by webhook secret verification)
- Side effects:
  - Validate payload
  - Reject duplicate email with `409`
  - Create lead
  - Compute score
  - Send initial email
  - Create outbound email record

#### `GET /api/v1/leads`

- Auth: Required
- Query params:
  - `status`
  - `minScore`
- Result: Returns lead list

#### `GET /api/v1/leads/:id`

- Auth: Required
- Result: Returns lead detail plus email history

#### `PATCH /api/v1/leads/:id`

- Auth: Required
- Result: Updates `pipeline_status` manually

### Emails

#### `POST /api/v1/emails/poll`

- Auth: `CRON_SECRET` header
- Side effects:
  - Fetch Gmail replies
  - Store inbound email records
  - Recalculate `InteractionScore` and `TotalScore`
  - Generate draft records

#### `POST /api/v1/emails/:id/send`

- Auth: Required
- Side effects:
  - Validate `PendingApproval` draft state
  - Send Gmail reply in same `thread_id`
  - Update lead `last_email_sent_at`
  - Mark draft status `Sent`

## 4. Authentication and Authorization

JWT payload:

```json
{
  "sub": "user_id",
  "role": "admin",
  "exp": 1700000000
}
```

Password policy:

- `bcrypt` with 12 salt rounds
- Minimum 8 characters
- At least 1 uppercase character
- At least 1 number

## 5. Data Validation Rules

Email:

- Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

Name:

- Max length: 255 characters

Budget:

- Must be a positive integer

Body:

- Max length: 10,000 characters

## 6. Error Handling

Standard error format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is invalid"
  }
}
```

Error codes:

- `VALIDATION_ERROR` -> `400`
- `UNAUTHORIZED` -> `401`
- `FORBIDDEN` -> `403`
- `NOT_FOUND` -> `404`
- `INTERNAL_ERROR` -> `500`

## 7. Rate Limiting

- Login: 5 attempts per 15 minutes per IP
- Webhook: 60 requests per minute
- Admin API: 120 requests per minute per user
- If exceeded: return `429`

## 8. Database Migrations

MVP:

- Manual Airtable schema sync

Future:

- Prisma Migrate for PostgreSQL

Rollback:

- Revert schema version document
- Restore latest backup

## 9. Backup and Recovery

Frequency:

- Weekly export

Retention:

- 30 days

Recovery process:

1. Export CSV from backup.
2. Restore into Airtable base.
3. Verify row counts.
4. Reconnect API keys.

## 10. API Versioning

- Current version: `v1`
- Structure: `/api/v1/`
- Breaking changes:
  - Introduce `/api/v2/`
  - Deprecate previous version after 90 days
