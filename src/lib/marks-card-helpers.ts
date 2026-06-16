import { getFilteredMarksheet } from "@/lib/grade-card-filter";
import type { MarksheetCourse, StudentMarksheet } from "@/lib/marksheet";
import { resolveObtainedMarks } from "@/lib/marks-resolution";

export type MarksCardCourseValues = {
  courseType: "THEORY" | "PRACTICAL";
  ciaMax: number;
  ciaMin: number;
  ciaScored: number;
  eseMax: number;
  eseMin: number;
  eseScored: number;
  status: string;
};

/** Default minimum marks when not supplied in Excel (40% of max; practical CIA uses 5/12). */
export function defaultMinMarks(max: number, practical = false): number {
  if (max <= 0) return 0;
  if (practical) return Math.round(max * (5 / 12));
  return Math.round(max * 0.4);
}

export function resolveCourseStatus(statusRaw: string, grade: string): string {
  const status = statusRaw.trim().toUpperCase();
  if (status === "PASS" || status === "P") return "PASS";
  if (status === "FAIL" || status === "F") return "FAIL";
  if (status === "RA") return "RA";

  const letter = grade.trim().toUpperCase();
  if (letter === "RA") return "RA";
  if (letter === "F" || letter === "FAIL") return "FAIL";
  return "PASS";
}

export function getMarksCardCourseType(course: MarksheetCourse): "THEORY" | "PRACTICAL" {
  const explicit = String(course.course_type ?? "").trim().toUpperCase();
  if (explicit.includes("PRACTICAL")) return "PRACTICAL";
  if (explicit.includes("THEORY")) return "THEORY";
  if (String(course.section).toUpperCase().includes("PRACTICAL")) return "PRACTICAL";
  return "THEORY";
}

export function getMarksCardCourseValues(course: MarksheetCourse): MarksCardCourseValues {
  const courseType = getMarksCardCourseType(course);
  const isPractical = courseType === "PRACTICAL";

  const ciaMax = isPractical
    ? Number(course.cia_max_marks_practical ?? 0)
    : Number(course.cia_max_marks_theory ?? 0);
  const obtained = resolveObtainedMarks(course);
  const ciaScored = obtained.cia;
  const eseMax = isPractical
    ? Number(course.ese_max_marks_practical ?? 0)
    : Number(course.ese_max_marks_theory ?? 0);
  const eseScored = obtained.ese;

  const ciaMinRaw = isPractical ? course.cia_min_marks_practical : course.cia_min_marks_theory;
  const eseMinRaw = isPractical ? course.ese_min_marks_practical : course.ese_min_marks_theory;

  return {
    courseType,
    ciaMax,
    ciaMin: Number(ciaMinRaw ?? 0) || defaultMinMarks(ciaMax, isPractical),
    ciaScored,
    eseMax,
    eseMin: Number(eseMinRaw ?? 0) || defaultMinMarks(eseMax, false),
    eseScored,
    status: resolveCourseStatus(String(course.course_status ?? ""), course.grade_obtained),
  };
}

export function calculateMarksCardTotals(courses: MarksheetCourse[]) {
  let obtained = 0;
  let maxTotal = 0;

  for (const course of courses) {
    const values = getMarksCardCourseValues(course);
    obtained += values.ciaScored + values.eseScored;
    maxTotal += values.ciaMax + values.eseMax;
  }

  return { obtained, maxTotal };
}

/** Semester-wise marks card: same course filtering as grade card (exclude prior-semester codes). */
export function filterMarksheetForMarksCard(
  marksheet: StudentMarksheet,
  allMarksheets: StudentMarksheet[],
): StudentMarksheet {
  if (!allMarksheets.length) return marksheet;
  return getFilteredMarksheet(marksheet, allMarksheets, false) ?? marksheet;
}

/**
 * Semester result on the marks card — PASS when every subject passed, otherwise RA.
 * Uses the same per-subject pass detection as the marks card status column.
 */
export function marksCardSemesterResult(courses: MarksheetCourse[]): string {
  if (!courses.length) return "-";
  const allPassed = courses.every(
    (course) =>
      resolveCourseStatus(String(course.course_status ?? ""), course.grade_obtained) === "PASS",
  );
  return allPassed ? "PASS" : "RA";
}
