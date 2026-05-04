# Marksheet Verification Design

## Context

The live Supabase database uses `public.student_marksheets` as the dynamic source for official marksheet data. The table is linked to `public.students` through `student_id`.

The older review code still reads from tables such as `student_marks`, `grade_card_details`, and `main_grade_card`. Those tables are not present in the current live schema, so the review portals should be moved to `student_marksheets`.

## Goals

- Admin and Faculty review the same dynamic marksheet data that students will generate.
- Faculty can re-verify only the marksheet.
- Admin can review fees, hostel clearance, library clearance, and marksheet together for one student.
- Admin and Faculty cannot edit fee, clearance, or marksheet data.
- Mistakes are reported to Super Admin through `portal_notifications`.
- Students can generate a marksheet only when clearances are complete, a marksheet exists, and both Faculty and Admin have verified.

## Roles

### Faculty

Faculty sees a marksheet-focused queue and a student detail review page.

Faculty may:

- Read the official marksheet row from `student_marksheets`.
- Review course rows, credits, grades, SGPA, final grade, and printed header fields.
- Set or remove `students.faculty_verified`.
- Report marksheet mistakes to Super Admin.

Faculty may not:

- Edit marksheet fields.
- Edit payments or clearances.
- Set `students.admin_verified` or `students.fully_verified`.

### Admin

Admin sees a full student verification queue and a student detail review page.

Admin may:

- Read student academic fee, hostel fee, library status, and marksheet in one place.
- Set or remove `students.admin_verified`.
- Report fee, hostel, library, or marksheet mistakes to Super Admin.

Admin may not:

- Edit payment amounts.
- Edit clearance booleans.
- Edit marksheet fields.
- Override Faculty verification.

### Super Admin

Super Admin remains the only role responsible for correcting source data.

Super Admin receives mistake reports through `portal_notifications` and updates student, fee, clearance, or marksheet data as needed.

## Eligibility Rule

A student may generate the PDF marksheet only when:

- A `student_marksheets` row exists for the student.
- `students.fees_cleared` is true.
- If the student is in hostel, `students.hostel_cleared` is true.
- If the student is in library, `students.library_cleared` is true and no remote library penalty is detected.
- `students.faculty_verified` is true.
- `students.admin_verified` is true.

`students.fully_verified` should mirror the final unlock state only when both Faculty and Admin have verified. UI checks should still use the explicit eligibility rule above so the portal remains understandable.

## UI Design

### Faculty Queue

Each row shows:

- Student name and roll number.
- Marksheet availability.
- Programme, semester, course count, SGPA, final grade.
- Faculty verification status.
- Link to the read-only detail page.

### Admin Queue

Each row shows:

- Student name and roll number.
- Academic fee paid/total and clearance status.
- Hostel paid/total and clearance status when applicable.
- Library clearance status when applicable.
- Marksheet availability and summary.
- Faculty verification status.
- Admin verification status.
- Locked/unlocked result.
- Link to the read-only detail page.

### Student Detail Review

The shared review panel loads:

- `students` row.
- Matching `student_marksheets` row.

Faculty mode shows only marksheet data and marksheet issue reporting.

Admin mode shows:

- Student identity.
- Academic fee paid/total/pending and clearance.
- Hostel paid/total/pending and clearance.
- Library enrollment/clearance.
- Full marksheet header and course rows.
- Faculty/Admin verification state.
- Issue reporting to Super Admin.

## Data Flow

- Read students from `students`.
- Read marksheets from `student_marksheets`.
- Send issue reports through `portal_notifications` with `recipient_portal = 'super_admin'`.
- Faculty verification updates only `faculty_verified`; removing Faculty verification also clears Admin and full verification because Admin must re-review after Faculty changes.
- Admin verification updates only `admin_verified` and sets `fully_verified` to true only if Faculty is already verified and the student is otherwise eligible.
- Student marksheet generation re-checks eligibility before OTP and download.

## Testing

Add focused tests for pure eligibility and summary helpers:

- Student with no marksheet is locked.
- Student with clear fees, hostel, library, Faculty, Admin, and marksheet is unlocked.
- Faculty verification removal clears downstream Admin/full verification through the update payload helper.
- Admin verification cannot produce `fully_verified` unless Faculty is already verified and clearances are complete.

Run:

- `npm run lint`
- `npm run build`

