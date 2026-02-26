# SCORING_SPEC.md

## Deterministic Scoring Specification

- Product: Formative CRM
- Version: 1.0
- Last Updated: 2026-02-21

## 1. Purpose

This document defines the deterministic scoring logic used to classify leads as `Hot`, `Warm`, or `Cold`.

Scoring must be:

- Fully deterministic
- Formula-based
- Testable
- Side-effect free
- Independent of machine learning

No dynamic weight adjustment is allowed.

## 2. Score Components

Each lead has three numeric values:

- `FormScore`
- `InteractionScore`
- `TotalScore`

Formula:

`TotalScore = (0.6 x FormScore) + (0.4 x InteractionScore)`

All scores must be rounded to one decimal place using standard rounding rules.

Examples:

- `84.44 -> 84.4`
- `84.45 -> 84.5`

## 3. FormScore Specification

`FormScore` evaluates the initial Typeform submission.

Maximum possible `FormScore`: `100`

The following fields are scored.

### 3.1 Budget Strength (0-30 points)

| Condition | Points |
| --- | --- |
| Budget above premium threshold | 30 |
| Budget mid tier | 20 |
| Budget entry tier | 10 |
| Budget unspecified or very low | 0 |

Premium threshold must be configurable via environment variable.

### 3.2 Purchase Timeline (0-25 points)

| Timeline | Points |
| --- | --- |
| Immediate (0-1 month) | 25 |
| 1-3 months | 18 |
| 3-6 months | 10 |
| 6+ months | 5 |
| Just browsing | 0 |

### 3.3 Payment Readiness (0-20 points)

| Condition | Points |
| --- | --- |
| Cash ready | 20 |
| Mortgage pre approved | 15 |
| Mortgage planning | 8 |
| Not specified | 0 |

### 3.4 Location Match Quality (0-15 points)

| Condition | Points |
| --- | --- |
| Preferred core area (Lekki or Victoria Island) | 15 |
| Nearby areas | 10 |
| Outside target zones | 5 |
| Not specified | 0 |

### 3.5 Property Type Specificity (0-10 points)

| Condition | Points |
| --- | --- |
| Specific property type selected | 10 |
| Broad category | 5 |
| Not specified | 0 |

### 3.6 FormScore Formula

`FormScore = BudgetScore + TimelineScore + PaymentScore + LocationScore + PropertyTypeScore`

Maximum = `100`

## 4. InteractionScore Specification

`InteractionScore` evaluates buyer engagement after initial contact.

Maximum possible `InteractionScore`: `100`

### 4.1 Reply Speed (0-30 points)

Measured from `last_email_sent_at`.

| Time to Reply | Points |
| --- | --- |
| Under 6 hours | 30 |
| 6-24 hours | 20 |
| 1-3 days | 10 |
| 3+ days | 5 |
| No reply | 0 |

### 4.2 Intent Language Detection (0-40 points)

Keyword-based deterministic scoring.

High intent keywords (`40` points):

- `schedule viewing`
- `book viewing`
- `ready to buy`
- `cash ready`
- `when can we meet`

Medium intent keywords (`25` points):

- `interested`
- `tell me more`
- `available`
- `price negotiable`

Low intent keywords (`10` points):

- `still considering`
- `maybe later`
- `just checking`

No clear intent: `0`

Only the highest matching category applies.

### 4.3 Message Length Strength (0-15 points)

| Word Count | Points |
| --- | --- |
| 50+ words | 15 |
| 20-49 words | 10 |
| 5-19 words | 5 |
| Under 5 words | 0 |

### 4.4 Follow Up Depth (0-15 points)

| Condition | Points |
| --- | --- |
| Second reply in thread | 10 |
| Third or more reply | 15 |
| First reply only | 5 |
| No reply | 0 |

### 4.5 InteractionScore Formula

`InteractionScore = ReplySpeedScore + IntentScore + LengthScore + FollowUpScore`

Maximum = `100`

## 5. TotalScore Calculation

`TotalScore = (0.6 x FormScore) + (0.4 x InteractionScore)`

Round to one decimal place.

## 6. Lead Label Thresholds

| TotalScore Range | Label |
| --- | --- |
| 75-100 | Hot |
| 50-74.9 | Warm |
| 0-49.9 | Cold |

Threshold boundaries are inclusive.

Examples:

- `75.0 -> Hot`
- `74.9 -> Warm`
- `50.0 -> Warm`
- `49.9 -> Cold`

## 7. Deterministic Rules

1. No AI weighting in scoring.
2. Keyword matching must be case-insensitive.
3. Only one `IntentScore` category may apply per message.
4. Scores must not exceed `100`.
5. Missing data results in zero points for that category.
6. Scoring functions must be pure and stateless.

## 8. Required Test Cases

### Test Case 1: High Intent Buyer

Input profile:

- Premium budget
- Immediate purchase
- Cash ready
- Core location
- Specific property type

Expected:

- `FormScore = 98.9` (reference test value)
- `InteractionScore = 85.5` (reference test value)
- `TotalScore` correctly calculated and rounded

### Test Case 2: Medium Intent Buyer

Input profile:

- Mid tier budget
- 3 month timeline
- Mortgage planning
- Core location
- Broad property type

Expected:

- `FormScore` between `55` and `70`
- Label = `Warm`

### Test Case 3: Low Intent Buyer

Input profile:

- Low budget
- 6+ month timeline
- No payment readiness
- Outside target zone
- No property type

Expected:

- `FormScore` under `40`
- Label = `Cold`

## 9. Implementation Rules

- Scoring logic must live in an isolated service file.
- Must include unit tests.
- Must not perform database writes.
- Must not depend on external APIs.
- Must be callable independently.

## 10. Governance

This scoring system guarantees:

- Predictable prioritization
- Clear classification
- No black-box logic
- Complete transparency

Any modification requires a version increment and documented approval.
