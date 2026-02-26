# TECH_STACK.md

- Project: Formative CRM
- App Type: Web App
- Scale: MVP to small production
- Team Size: 1 developer using Codex
- MVP Target: 4 weeks

This document locks the technology choices for the project. Versions are pinned for consistency and predictable delivery.

## 1. Stack Overview

### Architecture Pattern

- Serverless monolith.
- Single Next.js application.
- API routes handle backend logic.
- Airtable as primary data store.
- Gmail API integration.
- Scheduled polling with Vercel Cron.

### Why This Architecture

- Small team.
- Fast iteration.
- Low infrastructure overhead.
- Avoids microservice complexity.
- Scales adequately for early-stage CRM needs.

### Alternatives Considered

- Microservices: rejected due to complexity.
- Express server on VPS: rejected due to slower deployment cycle.
- Full AWS stack: rejected as overkill for MVP.

### Deployment Strategy

- GitHub to Vercel auto-deploy.
- Production branch: `main`.
- Preview deployments for pull requests.
- Zero manual deployment steps.

## 2. Frontend Stack

### Framework

- Next.js `14.1.0`
- Docs: <https://nextjs.org/docs>
- License: MIT
- Reason:
  - Full-stack framework.
  - Built-in API routes and routing.
  - Optimized for serverless/Vercel deployment.

### Language

- TypeScript `5.3.3`
- Docs: <https://www.typescriptlang.org/docs>
- License: Apache 2.0
- Reason:
  - Type safety for CRM logic.
  - Reduces runtime scoring and workflow bugs.

### Styling

- Tailwind CSS `3.4.1`
- Docs: <https://tailwindcss.com/docs>
- License: MIT
- Reason:
  - Fast UI iteration.
  - Clean dashboard styling.
  - Avoids custom CSS bloat.

Alternative rejected:
- Styled Components: runtime overhead.
- Material UI: too opinionated for target design.

### State Management

- Zustand `4.4.1`
- Docs: <https://docs.pmnd.rs/zustand>
- License: MIT
- Reason:
  - Lightweight.
  - Fits dashboard filters and session state.
  - Minimal boilerplate.

Alternative rejected:
- Redux: too heavy for MVP scope.

### Form Handling

- React Hook Form `7.49.2`
- Docs: <https://react-hook-form.com>
- License: MIT
- Reason:
  - High performance.
  - Strong TypeScript compatibility.

### HTTP Client

- Native Fetch API.
- Reason:
  - Built into Next.js/Node runtime.
  - No Axios dependency required.

### Routing

- Next.js App Router (built into 14.1.0).
- Reason:
  - File-based routing.
  - Simplifies admin route organization.

### UI Components

- shadcn/ui (commit snapshot: Feb 2026)
- Docs: <https://ui.shadcn.com>
- License: MIT
- Reason:
  - Clean admin UI baseline.
  - Tailwind-native.
  - Copy-based components with no runtime lock-in.

## 3. Backend Stack

Backend runs inside Next.js API routes.

### Runtime

- Node.js `20.11.1` LTS
- Docs: <https://nodejs.org/docs>
- License: MIT
- Reason:
  - Stable LTS.
  - Compatible with Next.js 14.

### Framework

- Next.js API Routes (`14.1.0`)
- Reason:
  - Unified frontend/backend deployment.
  - Avoids separate Express infrastructure.

Alternative considered:
- Express `4.18.2`: not required for MVP.

### Database

- Airtable API v0 REST
- Docs: <https://airtable.com/developers/web/api/introduction>
- Reason:
  - No database server maintenance.
  - Fast schema iteration for CRM.
  - Visual data operations.

Alternatives considered:
- PostgreSQL 15: more scalable but slower to launch.
- Supabase: candidate for V2.

### ORM

- None (direct Airtable REST integration).

### Caching

- None in MVP.
- Future option: Upstash Redis 7.2 if scale demands caching.

### Authentication

- NextAuth.js `4.24.5`
- Docs: <https://next-auth.js.org>
- License: ISC
- Method:
  - Email + password (credentials flow)
  - JWT session strategy
- Reason:
  - Secure.
  - Minimal configuration.
  - Next.js-native integration.

### Email

- Gmail API v1 (Google REST API)
- Docs: <https://developers.google.com/gmail/api>
- Reason:
  - Required for thread tracking.
  - Supports `thread_id` continuity.

Alternative rejected:
- Resend: insufficient for required thread control.

## 4. Database Strategy

### Data Storage

Airtable bases/tables (MVP):
- Leads
- Emails
- Logs

### Migration Strategy

- Manual schema updates in Airtable.
- Versioned schema document stored in repo.

### Backup Policy

- Weekly Airtable export.
- Manual CSV backup to secure storage.

### Connection Pooling

- Not required for Airtable REST.

## 5. DevOps and Infrastructure

### Version Control

- GitHub
- Branching model:
  - `main`: production
  - `dev`: staging
  - `feature/*`: feature branches

### CI/CD

- GitHub Actions `4.5.0`
- Pipeline steps:
  - TypeScript check
  - ESLint
  - Build
  - Deploy to Vercel on success

### Hosting

- Frontend + backend: Vercel (Pro plan)
- Database: Airtable Cloud

### Monitoring

- Sentry `7.101.0` for error tracking
- Vercel Analytics
- Custom logs table in Airtable

### Testing

- Unit: Vitest `1.2.2`
- Integration: Supertest `6.3.3`
- E2E: Playwright `1.41.2`

## 6. Development Tools

- ESLint `8.56.0`
- Prettier `3.2.4`
- Husky `9.0.11`
- VS Code (recommended IDE)

## 7. Environment Variables

```env
NEXTAUTH_SECRET="JWT signing secret"
NEXTAUTH_URL="Production URL"

AIRTABLE_API_KEY="Airtable API key"
AIRTABLE_BASE_ID="Base ID"

GOOGLE_CLIENT_ID="Google OAuth client ID"
GOOGLE_CLIENT_SECRET="Google OAuth client secret"
GOOGLE_REFRESH_TOKEN="Gmail refresh token"

CRON_SECRET="Protect scheduled endpoint"

SENTRY_DSN="Error monitoring DSN"
```

## 8. package.json Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint . --ext .ts,.tsx",
  "type-check": "tsc --noEmit",
  "test": "vitest",
  "e2e": "playwright test",
  "prepare": "husky install"
}
```

## 9. Dependencies Lock

### Frontend

```json
{
  "next": "14.1.0",
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "typescript": "5.3.3",
  "tailwindcss": "3.4.1",
  "zustand": "4.4.1",
  "react-hook-form": "7.49.2",
  "next-auth": "4.24.5",
  "@sentry/nextjs": "7.101.0"
}
```

### Backend

```json
{
  "googleapis": "128.0.0",
  "zod": "3.22.4",
  "vitest": "1.2.2",
  "supertest": "6.3.3",
  "playwright": "1.41.2"
}
```

## 10. Security Considerations

### Authentication

- JWT sessions.
- Session expiry: 24 hours.

### Password Hashing

- `bcrypt` with 12 salt rounds.

### CORS

- Allow only production domain.

### Rate Limiting

- 60 requests per minute per IP.

### Email Processing

- Validate Gmail `message_id` before scoring.
- Enforce strict thread matching.

### Secrets

- Store in encrypted Vercel environment variables.

## 11. Version Upgrade Policy

### Minor and Patch Updates

- Monthly review cycle.
- Apply patch updates after test pass.

### Major Updates

- Upgrade only after staging validation.
- Use dedicated upgrade branch.
- Run full regression suite.

### Rollback

- Revert Git commit.
- Redeploy previous build from Vercel deployment history.
