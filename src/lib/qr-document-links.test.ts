import { describe, expect, it } from "vitest";

import {
  buildDocumentQrTarget,
  getDocumentDownloadPath,
  parseQrScanKind,
} from "@/lib/qr-document-links";

describe("qr document links", () => {
  it("builds scan URLs with registration number only", () => {
    expect(buildDocumentQrTarget("grade", "24MAEC108", "https://results.gcu.edu.in")).toBe(
      "https://results.gcu.edu.in/scan/grade/24MAEC108",
    );
    expect(buildDocumentQrTarget("marks", "24MAEC108", "https://results.gcu.edu.in")).toBe(
      "https://results.gcu.edu.in/scan/marks/24MAEC108",
    );
    expect(buildDocumentQrTarget("degree", "24MAEC108", "https://results.gcu.edu.in")).toBe(
      "https://results.gcu.edu.in/scan/degree/24MAEC108",
    );
  });

  it("maps scan kinds to download pages", () => {
    expect(getDocumentDownloadPath("grade", "24MAEC108")).toBe(
      "/gradecard/download?reg=24MAEC108",
    );
    expect(getDocumentDownloadPath("marks", "24MAEC108")).toBe(
      "/markscard/download?reg=24MAEC108",
    );
    expect(getDocumentDownloadPath("degree", "24MAEC108")).toBe(
      "/degree/download?reg=24MAEC108",
    );
  });

  it("parses scan route kinds", () => {
    expect(parseQrScanKind("grade")).toBe("grade");
    expect(parseQrScanKind("marks")).toBe("marks");
    expect(parseQrScanKind("degree")).toBe("degree");
    expect(parseQrScanKind("invalid")).toBeNull();
  });
});
