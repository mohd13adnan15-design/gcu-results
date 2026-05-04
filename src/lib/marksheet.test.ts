import { describe, expect, it } from "vitest";

import {
  MARKSHEET_CGPA_SGPA_ROWS,
  MARKSHEET_CREDIT_POINT_EXAMPLES,
  MARKSHEET_GRADE_SCALE_ROWS,
  TEJASHVI_MARKSHEET_SEED,
  buildMarksheetFileName,
  calculateMarksheetTotals,
  groupCoursesBySection,
  pickStudentPhotoPath,
  studentMarksToMarksheet,
} from "./marksheet";
import type { Student } from "@/lib/types";

describe("marksheet data helpers", () => {
  it("keeps the seeded Tejashvi marksheet linked to 24btre152 with complete course rows", () => {
    expect(TEJASHVI_MARKSHEET_SEED.student_roll_no).toBe("24btre152");
    expect(TEJASHVI_MARKSHEET_SEED.student_name).toBe("V Sai Tejashvi");
    expect(TEJASHVI_MARKSHEET_SEED.courses).toHaveLength(11);
    expect(
      TEJASHVI_MARKSHEET_SEED.courses.every((course) => course.course_code && course.course_title),
    ).toBe(true);
  });

  it("builds a review marksheet from legacy student_marks-style rows", () => {
    const student: Student = {
      id: "uuid-1",
      student_id: "22BCAR241",
      email: "a@b.c",
      password: "x",
      full_name: "Test Student",
      department: "CSE",
      semester: 1,
      year: 1,
      in_library: false,
      in_hostel: false,
      in_fees: true,
      library_cleared: true,
      hostel_cleared: true,
      fees_cleared: true,
      fees_total: 0,
      fees_paid: 0,
      hostel_total: 0,
      hostel_paid: 0,
    };
    const header = {
      student_name: "Test Student",
      programme_title: "BCA",
      programme_code: "BCAR",
      registration_no: "22BCAR241",
      semester_label: "Semester 1",
      exam_month_year: "March 2023",
      issue_date: "2023-06-13",
      semester_gpa: 7.5,
      final_grade: "A",
    };
    const sheet = studentMarksToMarksheet(student, header, [
      {
        subject: "C Programming",
        subject_code: "CS101",
        course_category: "CORE COURSE",
        credits: 4,
        credits_earned: 4,
        grade: "A",
        grade_points: 8,
      },
    ]);
    expect(sheet).not.toBeNull();
    expect(sheet!.courses).toHaveLength(1);
    expect(sheet!.courses[0].course_code).toBe("CS101");
    expect(sheet!.student_roll_no).toBe("22BCAR241");
  });

  it("calculates totals from course credits and grade points", () => {
    expect(calculateMarksheetTotals(TEJASHVI_MARKSHEET_SEED.courses)).toEqual({
      totalCredits: 25,
      totalCreditsEarned: 25,
      totalCreditPoints: 209,
      sgpa: 8.36,
      finalGrade: "A+",
    });
  });

  it("groups courses in the same order as the grade-card reference", () => {
    expect(
      groupCoursesBySection(TEJASHVI_MARKSHEET_SEED.courses).map((group) => group.section),
    ).toEqual([
      "CORE COURSE",
      "PRACTICAL",
      "ABILITY ENHANCEMENT COMPULSORY COURSE",
      "SKILL ENHANCEMENT COURSE",
      "PRACTICAL",
      "OPEN ELECTIVE COURSE",
    ]);
  });

  it("creates stable student-specific filenames", () => {
    expect(buildMarksheetFileName(TEJASHVI_MARKSHEET_SEED, "pdf")).toBe(
      "24btre152-v-sai-tejashvi-marksheet.pdf",
    );
  });

  it("keeps the second PDF page grade reference content from the university reference", () => {
    expect(MARKSHEET_GRADE_SCALE_ROWS).toHaveLength(7);
    expect(MARKSHEET_GRADE_SCALE_ROWS[1]).toEqual({
      slNo: 2,
      marksRange: "89-80",
      letterGrade: "A+",
      gradePoints: "9",
      description: "Excellent",
    });
    expect(MARKSHEET_CREDIT_POINT_EXAMPLES.at(-1)).toEqual({
      course: "Total",
      gradeObtained: "",
      gradePoints: "",
      courseCredits: "24",
      creditPoints: "180",
    });
    expect(MARKSHEET_CGPA_SGPA_ROWS).toContainEqual({
      slNo: 2,
      range: "8.00 - 8.99",
      letterGrade: "A+",
      description: "Excellent",
    });
  });

  it("selects the uploaded student photo when the saved extension is stale", () => {
    expect(
      pickStudentPhotoPath({
        configuredPath: "24btre152/profile.jpg",
        rollNo: "24btre152",
        candidates: ["24btre152/profile.jpeg", "24btre152/side.png"],
      }),
    ).toBe("24btre152/profile.jpeg");
  });
});
