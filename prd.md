Product Requirements Document (PRD)
Feature: Robust LinkedIn Profile Extraction v1

Product: Ellyn – Email Discovery Workspace
Owner: Varun Sah
Status: Proposed
Priority: P0 (Critical reliability fix)

1. Background & Problem Statement

Ellyn currently attempts to extract LinkedIn profile data (starting with profile name) using a single, atomic scraping workflow.

This approach frequently fails with the error:

“Magic workflow failed: Could not extract profile name”

Why this is happening

LinkedIn uses a React-based, asynchronous DOM

The same data appears differently across page types

DOM class names change frequently

Extraction assumes perfect conditions

Any failure aborts the entire workflow

Impact

High failure rate on a core feature

Poor user trust (“it just breaks”)

High maintenance cost (chasing selectors)

Blocks downstream features (email discovery, drafts)

This is an architecture problem, not a selector bug.

2. Goal & Success Criteria
Primary Goal

Redesign LinkedIn profile extraction to be:

Resilient

User-recoverable

LinkedIn-safe

Maintainable

Success Criteria

❌ No hard workflow crashes due to missing fields

✅ Partial extraction can continue

✅ Users can manually confirm or edit data

✅ Clear UX feedback when extraction is blocked

✅ Reduced DOM-related failures by design

3. Non-Goals

This version will NOT:

Use LinkedIn APIs

Automate LinkedIn actions

Scrape hidden or background data

Guarantee 100% automatic extraction

Add backend dependencies

4. Constraints & Principles
Technical Constraints

Chrome Extension (Manifest V3)

User-initiated actions only

Visible DOM only

No background scraping

No automation (clicks, scrolls, typing)

Design Principles

Progressive over atomic

Confidence-based over boolean success

User-assisted over brittle automation

Graceful degradation over hard failure

Debuggable over “magic”

5. Proposed Architecture Overview
Architecture Name

Progressive, Human-in-the-Loop Extraction

Core Idea

Instead of treating extraction as a single pass/fail operation:

Extract fields independently

Assign confidence to each field

Continue workflow even with partial success

Ask user for confirmation when needed

6. System Components
6.1 Page Eligibility Detector

Determines whether the current LinkedIn page is supported.

Rules

URL must start with /in/

Feed, search, company pages are blocked

Output

{
  eligible: boolean,
  reason?: "NOT_PROFILE_PAGE" | "UNSUPPORTED_CONTEXT"
}

6.2 DOM Readiness Utility

Waits for LinkedIn’s React DOM to stabilize before extraction.

Characteristics

Poll-based or MutationObserver

Timeout: 5–7 seconds

Never throws errors

6.3 Field Extractors (Independent)

Each field has its own extractor:

extractName()

extractCompany()

extractRole()

Extractor Rules

Multiple strategies/selectors

Returns result + confidence

Never throws

Field Result Contract

{
  value: string | null,
  confidence: number, // 0.0 – 1.0
  source: "dom" | "fallback" | "user"
}

6.4 Confidence Engine

Evaluates whether extracted data is sufficient to proceed.

Example Rule

Name confidence < 0.7 → require user confirmation

Name confidence ≥ 0.7 → auto-continue

This replaces “success/failure” logic.

6.5 Human Confirmation Layer

When confidence is low:

Show extracted value (if any)

Allow user to edit or confirm

Persist confirmed value

Resume workflow

Why this matters

Prevents dead-ends

Improves data quality

Keeps user in control

Reduces retries and rage-clicks

6.6 Workflow Orchestrator

Controls overall flow without throwing exceptions.

Workflow States

type WorkflowResult =
  | { status: "success" }
  | { status: "partial"; needsUserInput: true }
  | { status: "blocked"; reason: string }

7. End-to-End User Flow
Case 1: Full Success

User opens LinkedIn profile

Clicks Ellyn

Data extracted with high confidence

Workflow continues automatically

Case 2: Partial Success

User opens LinkedIn profile

Clicks Ellyn

Name extracted with low confidence

User confirms/edits name

Workflow continues

Case 3: Blocked

User clicks Ellyn on feed/search page

Extension blocks extraction

Clear message shown:

“Please open a LinkedIn profile (linkedin.com/in/…) and try again.”

No crash, no retry loop.

8. UX Requirements
Error Messaging Guidelines

Human-readable

Actionable

No technical jargon

Never show raw exceptions

Examples

✅ “Please open a full LinkedIn profile and try again”

❌ “Could not extract profile name”

9. Technical Requirements Summary
Area	Requirement
Extraction	Progressive, field-based
Errors	No thrown errors for missing fields
UX	Manual confirmation fallback
Compliance	LinkedIn ToS safe
Maintenance	Minimal selector churn
Debugging	Console logging allowed
10. Risks & Mitigations
Risk: LinkedIn DOM changes

Mitigation:
Multiple extractors + confidence-based continuation

Risk: Lower automation purity

Mitigation:
Better UX + higher reliability

Risk: Slightly more UI work

Mitigation:
One-time cost, long-term stability

11. Metrics to Track (Optional v1)

% workflows completed without crash

% workflows requiring user confirmation

% blocked due to wrong page

User retry rate

12. Rollout Plan

Implement architecture behind feature flag

Test on real LinkedIn profiles

Remove hard-fail logic

Ship as default extraction flow

13. Summary

This PRD proposes a structural fix, not a patch.

By shifting from:

“Extract everything or fail”
to
“Extract what we can, confirm the rest”

Ellyn becomes:

More reliable

More user-friendly

Easier to maintain

Safer against LinkedIn changes