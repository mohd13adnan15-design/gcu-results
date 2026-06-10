import { describe, expect, it } from "vitest";

import { getMarksCardCourseValues } from "@/lib/marks-card-helpers";
import {
  mapObtainedMarksToStorage,
  resolveObtainedMarks,
} from "@/lib/marks-resolution";
import {
  detectMarksObtainedFormat,
  normalizeExcelHeaderKey,
  parseMarksTemplateRow,
} from "@/lib/marks-excel-template";
import type { MarksheetCourse } from "@/lib/marksheet";

describe("marks-resolution", () => {
  it("maps theory obtained marks without zero-padding", () => {
    const stored = mapObtainedMarksToStorage("THEORY", 30, 45);
    expect(stored).toEqual({
      cia_marks_obtained: 30,
      ese_marks_obtained: 45,
      cia_marks_obtained_theory: 30,
      cia_marks_obtained_practical: null,
      ese_marks_obtained_theory: 45,
      ese_marks_obtained_practical: null,
    });
  });

  it("maps practical obtained marks without zero-padding", () => {
    const stored = mapObtainedMarksToStorage("PRACTICAL", 38, 57);
    expect(stored).toEqual({
      cia_marks_obtained: 38,
      ese_marks_obtained: 57,
      cia_marks_obtained_theory: null,
      cia_marks_obtained_practical: 38,
      ese_marks_obtained_theory: null,
      ese_marks_obtained_practical: 57,
    });
  });

  it("resolves unified columns first", () => {
    const course: MarksheetCourse = {
      sl_no: 1,
      section: "CORE COURSE",
      course_code: "SUB101",
      course_title: "Subject",
      course_type: "THEORY",
      course_credits: 4,
      credits_earned: 4,
      cia_marks_obtained: 30,
      ese_marks_obtained: 45,
      grade_obtained: "A",
      grade_points: 8,
    };
    expect(resolveObtainedMarks(course)).toEqual({ cia: 30, ese: 45 });
  });

  it("resolves legacy split columns by course type", () => {
    const course: MarksheetCourse = {
      sl_no: 1,
      section: "CORE COURSE",
      course_code: "SUB103P",
      course_title: "Lab",
      course_type: "PRACTICAL",
      course_credits: 4,
      credits_earned: 4,
      cia_marks_obtained_practical: 38,
      ese_marks_obtained_practical: 57,
      grade_obtained: "O",
      grade_points: 10,
    };
    expect(resolveObtainedMarks(course)).toEqual({ cia: 38, ese: 57 });
  });

  it("keeps marks card PDF values unchanged for unified rows", () => {
    const course: MarksheetCourse = {
      sl_no: 1,
      section: "CORE COURSE",
      course_code: "SUB101",
      course_title: "Subject",
      course_type: "THEORY",
      course_credits: 4,
      credits_earned: 4,
      cia_max_marks_theory: 40,
      ese_max_marks_theory: 60,
      cia_marks_obtained: 30,
      ese_marks_obtained: 45,
      grade_obtained: "A",
      grade_points: 8,
    };
    const values = getMarksCardCourseValues(course);
    expect(values.ciaScored).toBe(30);
    expect(values.eseScored).toBe(45);
    expect(values.courseType).toBe("THEORY");
  });
});

describe("marks-excel-template unified format", () => {
  it("detects unified obtained format", () => {
    expect(
      detectMarksObtainedFormat([
        normalizeExcelHeaderKey("CIA Marks Obtained"),
        normalizeExcelHeaderKey("ESE Marks Obtained"),
      ]),
    ).toBe("unified");
    expect(
      detectMarksObtainedFormat([
        normalizeExcelHeaderKey("CIA Marks Obtained Theory"),
        normalizeExcelHeaderKey("CIA Marks Obtained Practical"),
      ]),
    ).toBe("split");
  });

  it("parses unified excel row using course type", () => {
    const row = parseMarksTemplateRow({
      studentid: "23BSFT101",
      email: "23bsft101@gcu.edu.in",
      studentname: "Test Student",
      coursecode: "SUB101",
      coursetitle: "Subject One",
      coursetype: "THEORY",
      ciamarksobtained: 30,
      esemarksobtained: 45,
      gradeobtained: "A",
      gradepoints: 8,
      coursecredits: 4,
      creditsearned: 4,
    });

    expect(row).not.toBeNull();
    expect(row?.cia_marks_obtained).toBe(30);
    expect(row?.ese_marks_obtained).toBe(45);
    expect(row?.cia_marks_obtained_theory).toBe(30);
    expect(row?.cia_marks_obtained_practical).toBeNull();
    expect(row?.ese_marks_obtained_theory).toBe(45);
    expect(row?.ese_marks_obtained_practical).toBeNull();
  });

  it("parses split excel row for backward compatibility", () => {
    const row = parseMarksTemplateRow({
      studentid: "23BSFT101",
      email: "23bsft101@gcu.edu.in",
      studentname: "Test Student",
      coursecode: "SUB103P",
      coursetitle: "Lab",
      coursetype: "PRACTICAL",
      ciamarksobtainedtheory: 0,
      ciamarksobtainedpractical: 38,
      esemarksobtainedtheory: 0,
      esemarksobtainedpractical: 57,
      gradeobtained: "O",
      gradepoints: 10,
      coursecredits: 4,
      creditsearned: 4,
    });

    expect(row).not.toBeNull();
    expect(row?.cia_marks_obtained).toBe(38);
    expect(row?.ese_marks_obtained).toBe(57);
    expect(row?.cia_marks_obtained_practical).toBe(38);
    expect(row?.cia_marks_obtained_theory).toBeNull();
  });
});
