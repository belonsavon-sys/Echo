# Risk Register

## Current Risks

### R-001 Data Integrity
- Description: Reporting totals and timeline totals diverge
- Impact: High
- Likelihood: Medium
- Mitigation: Add reconciliation checks and regression cases

### R-002 Deployment Misconfiguration
- Description: Different DB URLs across local and deploy environments
- Impact: High
- Likelihood: Medium
- Mitigation: Standardized env checklist and deployment runbook

### R-003 Authentication Session Confusion
- Description: Session persistence behavior unclear to users
- Impact: Medium
- Likelihood: Medium
- Mitigation: Remember-me control and explicit UX copy

### R-004 Scope Creep
- Description: Too many simultaneous feature changes
- Impact: Medium
- Likelihood: High
- Mitigation: One-change-at-a-time sprint gate

### R-005 Cross-Tenant Data Exposure
- Description: Missing user scoping on data access can leak data across accounts
- Impact: High
- Likelihood: Low
- Mitigation: Fail-closed storage layer requires authenticated `userId`; regression tests cover missing-user behavior

### R-006 Dev Auth Enabled In Production
- Description: `LOCAL_DEV_AUTH=true` in production could bypass real token validation
- Impact: High
- Likelihood: Low
- Mitigation: Startup/auth guard blocks production boot when local dev auth is enabled; deploy checklist enforces env validation

### R-007 Dev Diagnostics Exposed In Production
- Description: Developer tooling endpoints/UI exposed in production could leak internal route information
- Impact: Medium
- Likelihood: Low
- Mitigation: Register `/api/dev/*` routes only outside production, require auth in dev, and verify absence in deploy checklist
