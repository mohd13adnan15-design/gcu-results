import type { Student } from "./types";

export type MarksheetMissingReason =
  | "marksheet"
  | "academic_fee"
  | "hostel_fee"
  | "library"
  | "faculty_review"
  | "admin_review";

export type MarksheetEligibility = {
  eligible: boolean;
  hasMarksheet: boolean;
  feesOk: boolean;
  hostelOk: boolean;
  libraryOk: boolean;
  facultyOk: boolean;
  adminOk: boolean;
  missing: MarksheetMissingReason[];
};

export type VerificationUpdate = {
  faculty_verified?: boolean;
  admin_verified?: boolean;
  fully_verified?: boolean;
};

export function getMarksheetEligibility({
  student,
  hasMarksheet,
  hasLibraryPenalty = false,
}: {
  student: Student;
  hasMarksheet: boolean;
  hasLibraryPenalty?: boolean;
}): MarksheetEligibility {
  const feesOk = Boolean(student.fees_cleared);
  const hostelOk = !student.in_hostel || Boolean(student.hostel_cleared);
  const libraryOk = !student.in_library || (Boolean(student.library_cleared) && !hasLibraryPenalty);
  const facultyOk = Boolean(student.faculty_verified);
  const adminOk = Boolean(student.admin_verified);

  const missing: MarksheetMissingReason[] = [];
  if (!hasMarksheet) missing.push("marksheet");
  if (!feesOk) missing.push("academic_fee");
  if (!hostelOk) missing.push("hostel_fee");
  if (!libraryOk) missing.push("library");
  if (!facultyOk) missing.push("faculty_review");
  if (!adminOk) missing.push("admin_review");

  return {
    eligible: missing.length === 0,
    hasMarksheet,
    feesOk,
    hostelOk,
    libraryOk,
    facultyOk,
    adminOk,
    missing,
  };
}

export function buildFacultyVerificationUpdate(next: boolean): VerificationUpdate {
  if (next) {
    return { faculty_verified: true };
  }

  return {
    faculty_verified: false,
    admin_verified: false,
    fully_verified: false,
  };
}

export function buildAdminVerificationUpdate({
  student,
  next,
  hasMarksheet,
  hasLibraryPenalty = false,
}: {
  student: Student;
  next: boolean;
  hasMarksheet: boolean;
  hasLibraryPenalty?: boolean;
}): VerificationUpdate {
  if (!next) {
    return {
      admin_verified: false,
      fully_verified: false,
    };
  }

  const eligibility = getMarksheetEligibility({
    student: { ...student, admin_verified: true },
    hasMarksheet,
    hasLibraryPenalty,
  });

  return {
    admin_verified: true,
    fully_verified: eligibility.eligible,
  };
}

export function calculateFeeStatus({
  paid,
  total,
  cleared,
}: {
  paid: number | string | null | undefined;
  total: number | string | null | undefined;
  cleared: boolean;
}) {
  const paidValue = normalizeMoney(paid);
  const totalValue = normalizeMoney(total);
  const pending = Math.max(0, totalValue - paidValue);
  const percent = totalValue > 0 ? Math.min(100, Math.round((paidValue / totalValue) * 100)) : 0;

  return {
    paid: paidValue,
    total: totalValue,
    pending,
    percent,
    cleared,
  };
}

export function missingReasonLabel(reason: MarksheetMissingReason) {
  switch (reason) {
    case "marksheet":
      return "Marksheet row missing";
    case "academic_fee":
      return "Academic fee pending";
    case "hostel_fee":
      return "Hostel fee pending";
    case "library":
      return "Library clearance pending";
    case "faculty_review":
      return "Faculty verification pending";
    case "admin_review":
      return "Admin verification pending";
  }
}

function normalizeMoney(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}
