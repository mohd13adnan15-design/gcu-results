import { describe, expect, it } from "vitest";

import {
  GCU_MARKS_TEMPLATE_HEADERS,
  resolveExpectedMarksTemplateHeaders,
  validateMarksTemplateHeaders,
  validateMarksTemplateHeadersAgainstExpected,
} from "@/lib/marks-excel-template";

describe("validateMarksTemplateHeaders", () => {
  it("accepts the full official GCU marks template header row", () => {
    expect(() => validateMarksTemplateHeaders([...GCU_MARKS_TEMPLATE_HEADERS])).not.toThrow();
    expect(resolveExpectedMarksTemplateHeaders([...GCU_MARKS_TEMPLATE_HEADERS])).toEqual(
      GCU_MARKS_TEMPLATE_HEADERS,
    );
  });

  it("rejects uploads missing any required column", () => {
    const partial = GCU_MARKS_TEMPLATE_HEADERS.filter((header) => header !== "Email");
    expect(() => validateMarksTemplateHeaders([...partial])).toThrow(/Missing required columns/);
    expect(() => validateMarksTemplateHeaders([...partial])).toThrow(/Email/);
  });

  it("rejects uploads with only the four previously lenient columns", () => {
    expect(() =>
      validateMarksTemplateHeaders([
        "Student ID",
        "Student Name",
        "Course Code",
        "Course Title",
      ]),
    ).toThrow(/Missing required columns/);
  });

  it("validates against an explicit expected header list", () => {
    expect(() =>
      validateMarksTemplateHeadersAgainstExpected(
        ["Sl No", "Email", "Student Name"],
        ["Sl No", "Email", "Student Name", "Department"],
      ),
    ).toThrow(/Department/);
  });
});
