import { getMarksCardCourseType } from "@/lib/marks-card-helpers";
import type { MarksheetCourse } from "@/lib/marksheet";

export type ObtainedMarks = {
  cia: number;
  ese: number;
};

export type StoredObtainedMarks = {
  cia_marks_obtained: number;
  ese_marks_obtained: number;
  cia_marks_obtained_theory: number | null;
  cia_marks_obtained_practical: number | null;
  ese_marks_obtained_theory: number | null;
  ese_marks_obtained_practical: number | null;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Resolve CIA/ESE obtained marks from unified or legacy split columns. */
export function resolveObtainedMarks(course: Pick<
  MarksheetCourse,
  | "course_type"
  | "section"
  | "cia_marks_obtained"
  | "ese_marks_obtained"
  | "cia_marks_obtained_theory"
  | "cia_marks_obtained_practical"
  | "ese_marks_obtained_theory"
  | "ese_marks_obtained_practical"
>): ObtainedMarks {
  const unifiedCia = finiteNumber(course.cia_marks_obtained);
  const unifiedEse = finiteNumber(course.ese_marks_obtained);
  if (unifiedCia != null || unifiedEse != null) {
    return {
      cia: unifiedCia ?? 0,
      ese: unifiedEse ?? 0,
    };
  }

  const isPractical = getMarksCardCourseType(course as MarksheetCourse) === "PRACTICAL";
  if (isPractical) {
    return {
      cia: finiteNumber(course.cia_marks_obtained_practical) ?? 0,
      ese: finiteNumber(course.ese_marks_obtained_practical) ?? 0,
    };
  }

  return {
    cia: finiteNumber(course.cia_marks_obtained_theory) ?? 0,
    ese: finiteNumber(course.ese_marks_obtained_theory) ?? 0,
  };
}

/** Map obtained marks to normalized + legacy split storage (no zero-padding). */
export function mapObtainedMarksToStorage(
  courseType: string,
  cia: number,
  ese: number,
): StoredObtainedMarks {
  const isPractical = courseType.toUpperCase().includes("PRACTICAL");

  if (isPractical) {
    return {
      cia_marks_obtained: cia,
      ese_marks_obtained: ese,
      cia_marks_obtained_theory: null,
      cia_marks_obtained_practical: cia,
      ese_marks_obtained_theory: null,
      ese_marks_obtained_practical: ese,
    };
  }

  return {
    cia_marks_obtained: cia,
    ese_marks_obtained: ese,
    cia_marks_obtained_theory: cia,
    cia_marks_obtained_practical: null,
    ese_marks_obtained_theory: ese,
    ese_marks_obtained_practical: null,
  };
}
