import { describe, expect, it } from "vitest";

import {
  formatPartialUploadMessage,
  formatUploadError,
  formatUploadSuccessMessage,
} from "@/lib/upload-toast-messages";

describe("upload toast messages", () => {
  it("shortens file read errors", () => {
    expect(
      formatUploadError(
        new Error(
          "The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.",
        ),
      ),
    ).toBe("Couldn't read that file. Close it in Excel and upload again.");
  });

  it("formats partial upload in one line", () => {
    expect(
      formatPartialUploadMessage(74, 2, [
        { row: 14, reason: "Missing critical fields" },
        { row: 15, reason: "Missing critical fields" },
        { row: 18, reason: "Missing critical fields" },
      ]),
    ).toBe("Imported 74 rows (2 students). 3 rows skipped (14, 15, 18).");
  });

  it("formats success message", () => {
    expect(formatUploadSuccessMessage(74, 2, 2)).toBe(
      "Imported 74 rows for 2 students. 2 photos matched.",
    );
  });
});
