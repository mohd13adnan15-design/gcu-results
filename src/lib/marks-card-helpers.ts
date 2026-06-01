import type { MarksheetCourse } from "@/lib/marksheet";

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
  const ciaScored = isPractical
    ? Number(course.cia_marks_obtained_practical ?? 0)
    : Number(course.cia_marks_obtained_theory ?? 0);
  const eseMax = isPractical
    ? Number(course.ese_max_marks_practical ?? 0)
    : Number(course.ese_max_marks_theory ?? 0);
  const eseScored = isPractical
    ? Number(course.ese_marks_obtained_practical ?? 0)
    : Number(course.ese_marks_obtained_theory ?? 0);

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

/** Class result label shown on the marks card (matches official sample bands). */
export function marksCardResultLabel(obtained: number, maxTotal: number): string {
  if (maxTotal <= 0) return "-";
  const pct = (obtained / maxTotal) * 100;
  if (pct >= 85) return "First Class with Distinction";
  if (pct >= 60) return "First Class";
  if (pct >= 50) return "Second Class";
  return "Fail";
}
