# Marksheet Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Faculty/Admin review to `student_marksheets`, keep reviewers read-only, and unlock student PDF generation only after complete clearance plus Faculty and Admin verification.

**Architecture:** Add small pure verification helpers with tests, then use those helpers in the Faculty queue, Admin queue, shared student review panel, and student marksheet route. Add a database trigger migration so `students.fully_verified` mirrors local clearance and review state when records change outside the UI.

**Tech Stack:** React 19, TanStack Router, Supabase JS, Vitest, Supabase Postgres.

---

### Task 1: Verification Helpers

**Files:**
- Create: `src/lib/marksheet-verification.ts`
- Test: `src/lib/marksheet-verification.test.ts`

- [ ] Write failing tests for eligibility, Faculty update payloads, Admin update payloads, and fee summaries.
- [ ] Run `npx vitest run src/lib/marksheet-verification.test.ts` and confirm the tests fail because the helper module does not exist.
- [ ] Implement helper functions.
- [ ] Run the same test command and confirm the tests pass.

### Task 2: Review Portals

**Files:**
- Modify: `src/routes/faculty.tsx`
- Modify: `src/routes/admin.tsx`
- Modify: `src/components/StudentMarksReviewPanel.tsx`
- Modify: `src/routes/student.marks-card.tsx`
- Modify: `src/lib/types.ts`

- [ ] Replace old `student_marks` reads with `student_marksheets`.
- [ ] Render dynamic marksheet summaries from `student_marksheets.courses`.
- [ ] Keep Faculty detail focused on marksheet only.
- [ ] Show Admin identity, academic fee, hostel fee, library status, and marksheet together.
- [ ] Keep data read-only for reviewers; only verification/report actions update DB.
- [ ] Re-check student eligibility before OTP/download.

### Task 3: Database Sync

**Files:**
- Create: `supabase/migrations/20260504153000_students_fully_verified_sync.sql`

- [ ] Add a trigger function that derives `fully_verified` from local clearance and verification columns.
- [ ] Apply the migration to Supabase.
- [ ] Backfill existing `students.fully_verified`.

### Task 4: Verification

**Commands:**
- `npx vitest run src/lib/marksheet-verification.test.ts src/lib/marksheet.test.ts`
- `npm run lint`
- `npm run build`

- [ ] Fix any test, lint, or build failures.
- [ ] Report actual verification output.

