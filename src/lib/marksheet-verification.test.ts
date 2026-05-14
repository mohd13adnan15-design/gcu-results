import { describe, expect, it } from "vitest";

import type { Student } from "./types";
import {
  buildAdminVerificationUpdate,
  buildFacultyVerificationUpdate,
  calculateFeeStatus,
  getFeeClearanceForCertificate,
  getMarksheetEligibility,
  studentRequestedMarksheetVerification,
} from "./marksheet-verification";

const clearStudent: Student = {
  id: "student-1",
  student_id: "24btre152",
  email: "student@gcu.edu.in",
  full_name: "V Sai Tejashvi",
  department: "BTRE",
  semester: 4,
  year: 2,
  in_library: true,
  in_hostel: true,
  in_fees: true,
  library_cleared: true,
  hostel_cleared: true,
  fees_cleared: true,
  faculty_verified: true,
  admin_verified: true,
  fully_verified: true,
  fees_total: 100000,
  fees_paid: 100000,
  hostel_total: 50000,
  hostel_paid: 50000,
  library_remote_profile_id: null,
};

describe("marksheet verification helpers", () => {
  it("locks a student when no marksheet row exists", () => {
    expect(
      getMarksheetEligibility({
        student: clearStudent,
        hasMarksheet: false,
        hasLibraryPenalty: false,
      }),
    ).toEqual({
      eligible: false,
      hasMarksheet: false,
      feesOk: true,
      hostelOk: true,
      libraryOk: true,
      facultyOk: true,
      adminOk: true,
      missing: ["marksheet"],
    });
  });

  it("unlocks a student only when clearances, reviews, and marksheet are present", () => {
    expect(
      getMarksheetEligibility({
        student: clearStudent,
        hasMarksheet: true,
        hasLibraryPenalty: false,
      }),
    ).toMatchObject({
      eligible: true,
      missing: [],
    });
  });

  it("includes the blocking reasons in the same order the UI displays them", () => {
    expect(
      getMarksheetEligibility({
        student: {
          ...clearStudent,
          fees_cleared: false,
          hostel_cleared: false,
          library_cleared: false,
          faculty_verified: false,
          admin_verified: false,
        },
        hasMarksheet: false,
        hasLibraryPenalty: true,
      }).missing,
    ).toEqual([
      "marksheet",
      "academic_fee",
      "hostel_fee",
      "library",
      "faculty_review",
      "admin_review",
    ]);
  });

  it("clears downstream admin and full verification when faculty removes verification", () => {
    expect(buildFacultyVerificationUpdate(false)).toEqual({
      faculty_verified: false,
      admin_verified: false,
      fully_verified: false,
    });
  });

  it("does not set full verification when admin verifies before faculty review", () => {
    expect(
      buildAdminVerificationUpdate({
        student: { ...clearStudent, faculty_verified: false, admin_verified: false },
        next: true,
        hasMarksheet: true,
        hasLibraryPenalty: false,
      }),
    ).toEqual({
      admin_verified: true,
      fully_verified: false,
    });
  });

  it("sets full verification when admin verifies an otherwise eligible student", () => {
    expect(
      buildAdminVerificationUpdate({
        student: { ...clearStudent, admin_verified: false, fully_verified: false },
        next: true,
        hasMarksheet: true,
        hasLibraryPenalty: false,
      }),
    ).toEqual({
      admin_verified: true,
      fully_verified: true,
    });
  });

  it("summarizes paid, total, pending, and clearance for money-bearing portals", () => {
    expect(calculateFeeStatus({ paid: 25000, total: 100000, cleared: false })).toEqual({
      paid: 25000,
      total: 100000,
      pending: 75000,
      percent: 25,
      cleared: false,
    });
  });

  it("treats fee clearance as all three portals including penalties", () => {
    expect(
      getFeeClearanceForCertificate({
        student: clearStudent,
        hasLibraryPenalty: false,
      }),
    ).toEqual({
      ok: true,
      feesOk: true,
      hostelOk: true,
      libraryOk: true,
    });

    expect(
      getFeeClearanceForCertificate({
        student: { ...clearStudent, fees_cleared: false },
        hasLibraryPenalty: false,
      }).ok,
    ).toBe(false);

    expect(
      getFeeClearanceForCertificate({
        student: clearStudent,
        hasLibraryPenalty: true,
      }).libraryOk,
    ).toBe(false);
  });

  it("detects student verification request timestamp", () => {
    expect(studentRequestedMarksheetVerification(clearStudent)).toBe(false);
    expect(
      studentRequestedMarksheetVerification({
        ...clearStudent,
        marksheet_verification_requested_at: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
