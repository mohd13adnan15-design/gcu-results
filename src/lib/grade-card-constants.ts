import type { StudentMarksheet } from "./marksheet";

/** A4 page size in points (matches jsPDF). 1pt ≈ 1px in template. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export const GRADE_CARD_ASSETS = {
  background: "/templates/assets/gcu-gradecard-bg.png",
  logo: "/templates/assets/ChatGPT Image May 11, 2026, 06_01_10 PM.png",
  seal: "/templates/assets/gcu-seal.png",
  embossedSeal: "/templates/assets/ChatGPT Image May 10, 2026, 11_02_44 PM.png",
  rightSignatureOld: "/templates/assets/ChatGPT Image May 10, 2026, 11_22_08 PM.png",
  rightSignatureNew: "/templates/assets/sibimamsign.png",
  backPage: "/templates/assets/file_00000000f02871f897434ec5582a144c.png",
} as const;

export const GRADE_CARD_COLORS = {
  gold: "#b8860b",
  red: "#7a1111",
  dark: "#141414",
  border: "#373737",
  paper: "#fdfcf7",
} as const;

export function isMarksheetAfterJuly2024(marksheet: StudentMarksheet) {
  if (!marksheet.exam_month_year) return true;
  const match = marksheet.exam_month_year.match(/([a-zA-Z]+)\s*(?:-)?\s*(\d{4})/);
  if (!match) return true;
  const month = match[1];
  const year = parseInt(match[2], 10);
  const d = new Date(`${month} 1, ${year}`);
  return d > new Date("July 31, 2024");
}

export function getControllerSignatureAsset(marksheet: StudentMarksheet) {
  return isMarksheetAfterJuly2024(marksheet)
    ? GRADE_CARD_ASSETS.rightSignatureNew
    : GRADE_CARD_ASSETS.rightSignatureOld;
}

export function formatGradeCardDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatGradeCardNumber(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

export function formatSgpa(value: number) {
  return Number(value).toFixed(2);
}

/** Official cards show roman numerals only (e.g. "IV" not "Semester IV"). */
export function formatSemesterDisplay(label: string) {
  const clean = (label || "").trim();
  if (!clean) return clean;
  const romanMatch = clean.match(/\b(I{1,3}|IV|VI{0,3}|IX|X)\b/i);
  if (romanMatch) return romanMatch[1]!.toUpperCase();
  const numMatch = clean.match(/(\d+)/);
  if (numMatch) {
    const map: Record<number, string> = {
      1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
    };
    const n = parseInt(numMatch[1]!, 10);
    if (map[n]) return map[n];
  }
  return clean;
}

/** Normalise programme title for display (comma spacing, trim). */
export function formatProgrammeTitleDisplay(title: string) {
  return (title || "").trim().replace(/,\s*/g, ", ");
}

/** Front-page header — QR, logo, and photo on one row (official GCU grade card). */
export const FRONT_PAGE_HEADER = {
  contentX: 32,
  /** Shared header band — QR, logo, and photo bottom-aligned on one row. */
  rowTop: 32,
  rowHeight: 84,
  qrLeft: 44,
  /** Official card QR is slightly larger than 42pt. */
  qrSize: 50,
  uniqueIdFontSize: 7.5,
  /** Space between grade-card code text and QR top (original has a clear gap). */
  uniqueIdGapAboveQr: 14,
  /** Code sits near the top of the header band, not tight on the QR. */
  uniqueIdTopOffset: 3,
  uniqueIdBlockWidth: 90,
  photoWidth: 68,
  photoHeight: 84,
  photoRightInset: 46,
  /** Hardcoded official logo size (pt) — do not scale dynamically. */
  logoWidth: 292,
  logoHeight: 74,
  schoolNameTop: 178,
  detailsTop: 206,
  gradeCardTitleTop: 278,
  tableTop: 296,
} as const;

export type FrontPageHeaderLayout = {
  uniqueId: { left: number; top: number; width: number };
  qr: { left: number; top: number; size: number };
  logo: { left: number; top: number; width: number; height: number };
  photo: { left: number; top: number; width: number; height: number };
};

/** Fixed positions: QR, logo (292×74), and photo bottom-aligned on one row. */
export function getFrontPageHeaderLayout(pageWidth: number = A4_WIDTH): FrontPageHeaderLayout {
  const { rowTop, rowHeight, qrLeft, qrSize, photoWidth, photoHeight, photoRightInset, logoWidth, logoHeight } =
    FRONT_PAGE_HEADER;

  const rowBottom = rowTop + rowHeight;
  const qrTop = rowBottom - qrSize;
  const uniqueIdTop = rowTop + FRONT_PAGE_HEADER.uniqueIdTopOffset;
  const uniqueIdBlockWidth = FRONT_PAGE_HEADER.uniqueIdBlockWidth;
  const uniqueIdLeft = qrLeft + qrSize / 2 - uniqueIdBlockWidth / 2;

  return {
    uniqueId: { left: uniqueIdLeft, top: uniqueIdTop, width: uniqueIdBlockWidth },
    qr: { left: qrLeft, top: qrTop, size: qrSize },
    logo: {
      left: (pageWidth - logoWidth) / 2,
      top: rowBottom - logoHeight,
      width: logoWidth,
      height: logoHeight,
    },
    photo: {
      left: pageWidth - photoRightInset - photoWidth,
      top: rowBottom - photoHeight,
      width: photoWidth,
      height: photoHeight,
    },
  };
}

/** @deprecated Use getFrontPageHeaderLayout().logo */
export function computeHeaderLogoLayout(
  _naturalWidth?: number,
  _naturalHeight?: number,
  pageWidth: number = A4_WIDTH,
): HeaderLogoLayout {
  return getFrontPageHeaderLayout(pageWidth).logo;
}

export type HeaderLogoLayout = FrontPageHeaderLayout["logo"];

export function resolveGradeCardDisplayId(marksheet: {
  grade_card_no?: string;
  registration_no?: string;
  student_roll_no?: string;
}): string {
  const stripHyphens = (value: string) => value.replace(/-/g, "").toUpperCase();

  const stored = marksheet.grade_card_no?.trim();
  if (stored && /^GCU/i.test(stored)) return stripHyphens(stored);

  const roll = (marksheet.registration_no || marksheet.student_roll_no || "").trim().toUpperCase();
  const match = roll.match(/^(\d{2})([A-Z]+)(\d+)$/);
  if (match) return `GCU${match[2]}${match[3]}`;

  return stripHyphens(stored || roll || "");
}

/** Front-page footer positions (A4 pt — matches drawFirstPageFooter in marksheet-documents.ts). */
export const FRONT_PAGE_FOOTER = {
  seal: { x: 32, y: 705, w: 96, h: 96 },
  embossedSeal: { x: 448, y: 672, w: 64, h: 64 },
  signatureNew: { x: 375, y: 735, w: 210, h: 93 },
  signatureOld: { x: 390, y: 742, w: 180, h: 80 },
} as const;

/** Back-page e-signature overlay (A4 pt). Measured from template PNG 1049×1500 → A4 pt. */
export const BACK_PAGE_LAYOUT = {
  tableBottom: 755,
  pageBorderBottom: 830,
  /** Keep footer content at least this far above the outer page border line. */
  borderClearance: 10,
  paperColor: GRADE_CARD_COLORS.paper,
  slots: {
    checkedBy: {
      centerX: 107,
      signatureTop: 758,
      image: { w: 110, h: 42 },
      label: { fontSize: 14, gapAbove: 6 },
      wipe: { w: 112 },
    },
    verifiedBy: {
      centerX: 466,
      signatureTop: 758,
      image: { w: 110, h: 42 },
      label: { fontSize: 14, gapAbove: 6 },
      wipe: { w: 112 },
    },
  },
} as const;

export function getBackPageFooterBottom(slot: (typeof BACK_PAGE_LAYOUT)["slots"]["checkedBy"]) {
  return slot.signatureTop + slot.image.h + slot.label.gapAbove + slot.label.fontSize;
}

export function getBackPageWipeHeight(slot: (typeof BACK_PAGE_LAYOUT)["slots"]["checkedBy"]) {
  const wipeTop = slot.signatureTop - 2;
  const footerBottom = getBackPageFooterBottom(slot);
  const maxWipeBottom = BACK_PAGE_LAYOUT.pageBorderBottom - BACK_PAGE_LAYOUT.borderClearance;
  return Math.min(footerBottom - wipeTop + 2, maxWipeBottom - wipeTop);
}
