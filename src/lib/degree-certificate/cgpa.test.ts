import { describe, expect, it } from "vitest";

import { calculateCgpaFromSemesters } from "@/lib/degree-certificate/cgpa";

describe("calculateCgpaFromSemesters", () => {
  it("averages semester SGPAs per COE specification", () => {
    const records = [
      { semesterLabel: "I", sgpa: 8.43, examMonthYear: "April - 2023" },
      { semesterLabel: "II", sgpa: 8.93, examMonthYear: "April - 2023" },
      { semesterLabel: "III", sgpa: 8.29, examMonthYear: "April - 2024" },
      { semesterLabel: "IV", sgpa: 8.93, examMonthYear: "April - 2024" },
      { semesterLabel: "V", sgpa: 8.79, examMonthYear: "April - 2025" },
      { semesterLabel: "VI", sgpa: 8.64, examMonthYear: "April - 2025" },
      { semesterLabel: "VII", sgpa: 9.36, examMonthYear: "April - 2026" },
      { semesterLabel: "VIII", sgpa: 8.57, examMonthYear: "April - 2026" },
    ];
    const cgpa = calculateCgpaFromSemesters(records);
    expect(cgpa).toBeCloseTo(8.7425, 3);
  });
});
