# Agile Operating Model

## Delivery Framework
- Method: Scrum-style sprints
- Sprint length: 2 weeks
- Team mode: single product owner + engineering execution

## Sprint Ceremonies
- Sprint Planning: define sprint goal and stories
- Mid-Sprint Review: status and risk checks
- Sprint Review: demo completed work
- Retrospective: what to improve in process

## Core Artifacts
- Product backlog
- Sprint backlog
- Definition of Ready
- Definition of Done
- Release checklist

## Definition of Ready
- Problem statement is clear
- Acceptance criteria are testable
- Data/API impact is identified
- Out-of-scope is listed

## Definition of Done
- Feature implemented
- Manual test scenarios passed
- No blocking console/server errors
- Basic regression checks passed
- CI check passed (push/PR pipeline green)
- Change documented in changelog/release note
- Security-sensitive changes include explicit guardrail tests (auth/tenant isolation)

## Work-In-Progress Rule
- One active feature/change request at a time
- Next item starts only after current item is verified
