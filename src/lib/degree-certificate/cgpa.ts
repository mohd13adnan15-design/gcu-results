import { MARKSHEET_CGPA_SGPA_ROWS } from "@/lib/marksheet";

import type { DegreeCertificateSemesterRecord } from "./types";

/** CGPA = sum of semester SGPAs ÷ number of semesters (per COE specification). */
export function calculateCgpaFromSemesters(records: DegreeCertificateSemesterRecord[]): number {
  const valid = records.filter((r) => Number.isFinite(r.sgpa) && r.sgpa > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, r) => acc + r.sgpa, 0);
  return sum / valid.length;
}

export function formatCgpa(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}

export function cgpaToGradeDescriptor(cgpa: number): { letter: string; description: string } {
  if (!Number.isFinite(cgpa) || cgpa <= 0) {
    return { letter: "—", description: "" };
  }
  for (const row of MARKSHEET_CGPA_SGPA_ROWS) {
    const match = row.range.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (!match) continue;
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    if (cgpa >= min && cgpa <= max + 0.001) {
      return { letter: row.letterGrade, description: row.description };
    }
  }
  if (cgpa >= 9) return { letter: "O", description: "Outstanding" };
  return { letter: "C", description: "Average" };
}

export function formatGradeWithDescriptor(cgpa: number): string {
  const { letter, description } = cgpaToGradeDescriptor(cgpa);
  if (!description) return letter;
  return `${letter} (${description})`;
}
