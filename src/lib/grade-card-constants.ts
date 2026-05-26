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
