import { describe, expect, it } from "vitest";

import {
  filterMarksheetForMarksCard,
  marksCardSemesterResult,
  resolveCourseStatus,
} from "@/lib/marks-card-helpers";
import type { MarksheetCourse, StudentMarksheet } from "@/lib/marksheet";

function course(
  code: string,
  overrides: Partial<MarksheetCourse> = {},
): MarksheetCourse {
  return {
    sl_no: 1,
    section: "CORE",
    course_code: code,
    course_title: code,
    course_type: "THEORY",
    course_credits: 4,
    credits_earned: 4,
    grade_obtained: "A",
    grade_points: 8,
    ...overrides,
  };
}

function sheet(
  semesterLabel: string,
  courses: MarksheetCourse[],
): StudentMarksheet {
  return {
    student_id: "s1",
    student_roll_no: "24btre001",
    university: "GCU",
    school_name: "School",
    programme_title: "B.Tech",
    programme_code: "BT",
    student_name: "Test Student",
    registration_no: "GCU24BTRE001",
    semester_label: semesterLabel,
    exam_month_year: "May 2026",
    issue_date: "2026-05-01",
    total_credits: 0,
    total_credits_earned: 0,
    total_credit_points: 0,
    sgpa: 0,
    final_grade: "A",
    grade_card_no: "",
    qr_data: "",
    photo_bucket: null,
    photo_path: null,
    courses,
  };
}

describe("marksCardSemesterResult", () => {
  it("returns PASS when every subject passed", () => {
    const courses = [
      course("SUB101", { course_status: "PASS" }),
      course("SUB102", { grade_obtained: "A+" }),
    ];
    expect(marksCardSemesterResult(courses)).toBe("PASS");
  });

  it("returns RA when at least one subject failed or is RA", () => {
    expect(marksCardSemesterResult([course("SUB101", { grade_obtained: "RA" })])).toBe("RA");
    expect(
      marksCardSemesterResult([
        course("SUB101", { course_status: "PASS" }),
        course("SUB102", { course_status: "FAIL" }),
      ]),
    ).toBe("RA");
    expect(
      marksCardSemesterResult([
        course("SUB101", { course_status: "PASS" }),
        course("SUB102", { course_status: "RA" }),
      ]),
    ).toBe("RA");
  });

  it("never returns FAIL as the semester result", () => {
    const courses = [course("SUB101", { course_status: "FAIL", grade_obtained: "F" })];
    expect(marksCardSemesterResult(courses)).toBe("RA");
    expect(marksCardSemesterResult(courses)).not.toBe("FAIL");
  });
});

describe("filterMarksheetForMarksCard", () => {
  it("keeps only courses not present in earlier semesters", () => {
    const sem1 = sheet("I", [course("SUB101"), course("SUB102")]);
    const sem4 = sheet("IV", [
      course("SUB101"),
      course("SUB102"),
      course("SUB401"),
      course("SUB402"),
    ]);

    const filtered = filterMarksheetForMarksCard(sem4, [sem1, sem4]);

    expect(filtered.courses.map((c) => c.course_code)).toEqual(["SUB401", "SUB402"]);
    expect(filtered.courses.map((c, i) => c.sl_no)).toEqual([1, 2]);
  });
});

describe("resolveCourseStatus", () => {
  it("maps fail statuses without affecting semester PASS/RA rules", () => {
    expect(resolveCourseStatus("FAIL", "F")).toBe("FAIL");
    expect(resolveCourseStatus("", "RA")).toBe("RA");
    expect(resolveCourseStatus("PASS", "A")).toBe("PASS");
  });
});
