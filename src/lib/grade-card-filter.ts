import { calculateMarksheetTotals, type StudentMarksheet } from "./marksheet";

export function getSemesterNumber(label: string): number {
  const clean = (label || "").toUpperCase().trim();
  if (clean.includes("VIII") || clean.includes("8")) return 8;
  if (clean.includes("VII") || clean.includes("7")) return 7;
  if (clean.includes("VI") || clean.includes("6")) return 6;
  if (clean.includes("IV") || clean.includes("4")) return 4;
  if (clean.includes("III") || clean.includes("3")) return 3;
  if (clean.includes("II") || clean.includes("2")) return 2;
  if (clean.includes("I") || clean.includes("1")) return 1;
  if (clean.includes("V") || clean.includes("5")) return 5;
  return 1;
}

export function getFilteredMarksheet(
  currentSheet: StudentMarksheet | null,
  allSheets: StudentMarksheet[],
  showAll: boolean,
): StudentMarksheet | null {
  if (!currentSheet) return null;
  if (showAll) {
    const sorted = [...allSheets].sort(
      (a, b) => getSemesterNumber(b.semester_label) - getSemesterNumber(a.semester_label),
    );
    const latest = sorted[0] || currentSheet;
    const reindexedCourses = (latest.courses || []).map((c, i) => ({ ...c, sl_no: i + 1 }));
    const totals = calculateMarksheetTotals(reindexedCourses);
    return {
      ...latest,
      courses: reindexedCourses,
      total_credits: totals.totalCredits,
      total_credits_earned: totals.totalCreditsEarned,
      total_credit_points: totals.totalCreditPoints,
      sgpa: totals.sgpa,
      final_grade: totals.finalGrade,
    };
  }

  const currentSemNum = getSemesterNumber(currentSheet.semester_label);
  const previousCourseCodes = new Set<string>();

  for (const sheet of allSheets) {
    if (getSemesterNumber(sheet.semester_label) < currentSemNum) {
      for (const c of sheet.courses || []) {
        const code = String(c.course_code || "").toUpperCase().trim();
        if (code) previousCourseCodes.add(code);
      }
    }
  }

  const filteredCourses = (currentSheet.courses || []).filter((c) => {
    const code = String(c.course_code || "").toUpperCase().trim();
    return !previousCourseCodes.has(code);
  });

  const reindexedCourses = filteredCourses.map((c, i) => ({ ...c, sl_no: i + 1 }));
  const totals = calculateMarksheetTotals(reindexedCourses);

  return {
    ...currentSheet,
    courses: reindexedCourses,
    total_credits: totals.totalCredits,
    total_credits_earned: totals.totalCreditsEarned,
    total_credit_points: totals.totalCreditPoints,
    sgpa: totals.sgpa,
    final_grade: totals.finalGrade,
  };
}

export function buildGradeCardFrontPages(
  activeSheet: StudentMarksheet | null,
  allSheets: StudentMarksheet[],
  showAllSemesters: boolean,
): StudentMarksheet[] {
  if (!activeSheet) return [];
  if (showAllSemesters) {
    return [...allSheets]
      .sort((a, b) => getSemesterNumber(a.semester_label) - getSemesterNumber(b.semester_label))
      .map((sheet) => getFilteredMarksheet(sheet, allSheets, false))
      .filter((sheet): sheet is StudentMarksheet => sheet !== null);
  }
  const filtered = getFilteredMarksheet(activeSheet, allSheets, false);
  return filtered ? [filtered] : [];
}
