import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import {
  buildMarksheetFileName,
  groupCoursesBySection,
  type StudentMarksheet,
} from "./marksheet";

const ASSET_PATHS = {
  background: "/templates/assets/gcu-gradecard-bg.png",
  logo: "/templates/assets/ChatGPT Image May 11, 2026, 06_01_10 PM.png",
  seal: "/templates/assets/gcu-seal.png",
  embossedSeal: "/templates/assets/ChatGPT Image May 10, 2026, 11_02_44 PM.png",
  rightSignatureOld: "/templates/assets/ChatGPT Image May 10, 2026, 11_22_08 PM.png",
  rightSignatureNew: "/templates/assets/sibimamsign.png",
  backPage: "/templates/assets/file_00000000f02871f897434ec5582a144c.png",
};

const GOLD: [number, number, number] = [184, 134, 11]; // DarkGoldenRod
const BLACK: [number, number, number] = [0, 0, 0];
const RED: [number, number, number] = [122, 17, 17] as const;
const DARK: [number, number, number] = [20, 20, 20] as const;
const BORDER: [number, number, number] = [55, 55, 55] as const;

/**
 * Back-page footer on template `file_00000000f02871f897434ec5582a144c.png` (1049×1500 px → A4 pt).
 * Wipe baked-in signature ink only; "Checked by" / "Verified by" labels remain from the template PNG.
 */
const BACK_PAGE_LAYOUT_REF = {
  tableBottom: 755,
  pageBorderBottom: 830,
  borderClearance: 10,
  paperColor: [253, 252, 247] as [number, number, number],
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

function getBackPageWipeHeightRef(slot: (typeof BACK_PAGE_LAYOUT_REF)["slots"]["checkedBy"]) {
  const wipeTop = slot.signatureTop - 2;
  const footerBottom = slot.signatureTop + slot.image.h + slot.label.gapAbove + slot.label.fontSize;
  const maxWipeBottom = BACK_PAGE_LAYOUT_REF.pageBorderBottom - BACK_PAGE_LAYOUT_REF.borderClearance;
  return Math.min(footerBottom - wipeTop + 2, maxWipeBottom - wipeTop);
}

export type BackPageSignatureOptions = {
  checkedByUrl?: string | null;
  verifiedByUrl?: string | null;
};

export type MarksheetDocumentOptions = {
  photoUrl?: string | null;
  allMarksheets?: StudentMarksheet[];
  backPageSignatures?: BackPageSignatureOptions;
};

type LoadedDataUrl = {
  dataUrl: string;
  type: "JPEG" | "PNG" | "WEBP";
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isMarksheetAfterJuly2024(marksheet: StudentMarksheet) {
  if (!marksheet.exam_month_year) return true;
  const match = marksheet.exam_month_year.match(/([a-zA-Z]+)\s*(?:-)?\s*(\d{4})/);
  if (!match) return true;
  const month = match[1];
  const year = parseInt(match[2], 10);
  const d = new Date(`${month} 1, ${year}`);
  return d > new Date("July 31, 2024");
}

export async function drawBackPageSignatures(
  doc: jsPDF,
  signatures: BackPageSignatureOptions,
) {
  doc.setFillColor(...BACK_PAGE_LAYOUT_REF.paperColor);

  async function drawSlot(
    url: string | null | undefined,
    slot: (typeof BACK_PAGE_LAYOUT_REF)["slots"]["checkedBy"],
    label: string,
  ) {
    if (!url) return false;
    const wipeTop = slot.signatureTop - 2;
    const wipeLeft = slot.centerX - slot.wipe.w / 2;
    const wipeHeight = getBackPageWipeHeightRef(slot);
    doc.rect(wipeLeft, wipeTop, slot.wipe.w, wipeHeight, "F");
    const loaded = await loadDataUrl(url, { dropLightBackground: true });
    if (!loaded) return false;
    const { w, h } = slot.image;
    const x = slot.centerX - w / 2;
    const y = slot.signatureTop;
    doc.addImage(loaded.dataUrl, loaded.type, x, y, w, h);
    doc.setFont("times", "normal");
    doc.setFontSize(slot.label.fontSize);
    setText(doc, DARK);
    const labelY = slot.signatureTop + h + slot.label.gapAbove + slot.label.fontSize * 0.85;
    doc.text(label, slot.centerX, labelY, { align: "center" });
    return true;
  }

  await drawSlot(signatures.checkedByUrl, BACK_PAGE_LAYOUT_REF.slots.checkedBy, "Checked by");
  await drawSlot(signatures.verifiedByUrl, BACK_PAGE_LAYOUT_REF.slots.verifiedBy, "Verified by");
}

export async function generateMarksheetPdf(
  marksheet: StudentMarksheet,
  options: MarksheetDocumentOptions = {},
) {
  const { generateMarksheetPdfFromTemplate } = await import("@/lib/grade-card-pdf");
  return generateMarksheetPdfFromTemplate(marksheet, options);
}

export async function generateAllSemestersPdf(
  marksheets: StudentMarksheet[],
  options: MarksheetDocumentOptions = {},
) {
  const { generateAllSemestersPdfFromTemplate } = await import("@/lib/grade-card-pdf");
  return generateAllSemestersPdfFromTemplate(marksheets, options);
}

export function downloadMarksheetBlob(marksheet: StudentMarksheet, extension: "pdf", blob: Blob) {
  downloadBlob(blob, buildMarksheetFileName(marksheet, extension));
}

function drawMarksheetPage(
  doc: jsPDF,
  inputMarksheet: StudentMarksheet,
  images: {
    background: LoadedDataUrl | null;
    logo: LoadedDataUrl | null;
    qr: LoadedDataUrl | null;
    seal: LoadedDataUrl | null;
    embossedSeal: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
    photo: LoadedDataUrl | null;
  },
  options: MarksheetDocumentOptions = {},
) {
  let marksheet = inputMarksheet;
  if (options.allMarksheets && options.allMarksheets.length > 0) {
    const SEMESTER_ORDER: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
      "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
      "SEM 1": 1, "SEM 2": 2, "SEM 3": 3, "SEM 4": 4, "SEM 5": 5, "SEM 6": 6, "SEM 7": 7, "SEM 8": 8
    };

    const getSemesterOrderValue = (label: string): number => {
      const norm = label.trim().toUpperCase().replace(/^SEM\s+/, "");
      return SEMESTER_ORDER[norm] || 99;
    };

    const currentVal = getSemesterOrderValue(marksheet.semester_label);
    const previousCourseCodes = new Set<string>();
    for (const otherMs of options.allMarksheets) {
      if (getSemesterOrderValue(otherMs.semester_label) < currentVal) {
        const otherCourses = otherMs.courses || [];
        for (const c of otherCourses) {
          if (c.course_code) {
            previousCourseCodes.add(c.course_code.trim().toUpperCase());
          }
        }
      }
    }

    if (previousCourseCodes.size > 0) {
      const filteredCourses = marksheet.courses.filter(c => {
        const code = c.course_code ? c.course_code.trim().toUpperCase() : "";
        return !previousCourseCodes.has(code);
      });
      const resequencedCourses = filteredCourses.map((c, idx) => ({
        ...c,
        sl_no: idx + 1,
      }));
      marksheet = {
        ...marksheet,
        courses: resequencedCourses,
      };
    }
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = 32;
  const width = pageWidth - x * 2;
  let y = 48;

  drawBackgroundTheme(doc, images.background, pageWidth, pageHeight);
  drawOuterBorder(doc, pageWidth, pageHeight);
  setStroke(doc);
  drawHeader(doc, marksheet, images, x, y, width);

  y += 120;
  doc.setFont("times", "bold");
  doc.setFontSize(14.5);
  setText(doc, RED);
  drawCenteredTextFit(doc, marksheet.school_name, pageWidth / 2, y, width - 20, 14.5, 11);

  y += 28;
  y = drawDetailsTable(doc, marksheet, x, y, width);
  y += 12;

  // GRADE CARD Header integrated into the flow
  setStroke(doc);
  doc.rect(x, y, width, 18, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  setText(doc, RED);
  doc.text("GRADE CARD", pageWidth / 2, y + 13, { align: "center" });
  y += 18;

  y = drawMarksTable(doc, marksheet, x, y, width);
  y = drawTotals(doc, marksheet, x, y, width);

  drawFirstPageFooter(doc, marksheet, images, y);
}

function drawOuterBorder(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const margin = 14;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, "S");
  doc.setLineWidth(0.45);
  doc.rect(margin + 2.5, margin + 2.5, pageWidth - (margin + 2.5) * 2, pageHeight - (margin + 2.5) * 2, "S");
}

function drawHeader(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    logo: LoadedDataUrl | null;
    qr: LoadedDataUrl | null;
    photo: LoadedDataUrl | null;
  },
  x: number,
  y: number,
  width: number,
) {
  const leftWidth = 100;
  const rightWidth = 100;

  doc.setFont("times", "bold");
  doc.setFontSize(7.5);
  setText(doc, DARK);
  const uniqueId = marksheet.student_id?.split("-")[0].toUpperCase() || marksheet.grade_card_no;
  doc.text(uniqueId, x + 32, y + 12, { align: "center" });
  if (images.qr) {
    doc.addImage(images.qr.dataUrl, images.qr.type, x + 12, y + 18, 42, 42);
  }

  if (images.logo) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoWidth = 310;
    const logoHeight = 155;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage(images.logo.dataUrl, images.logo.type, logoX, y - 40, logoWidth, logoHeight);
  }

  const photoX = x + width - rightWidth + 14;
  if (images.photo) {
    doc.addImage(images.photo.dataUrl, images.photo.type, photoX + 2, y + 3, 68, 84);
  } else {
    drawPhotoBox(doc, photoX + 2, y + 3, 68, 84);
  }
}

function drawDetailsTable(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
) {
  const baseRowHeight = 16;
  const col1X = x;

  const rows = [
    ["PROGRAMME TITLE", marksheet.programme_title, "PROGRAMME CODE", marksheet.programme_code],
    ["NAME OF THE STUDENT", marksheet.student_name, "REGISTRATION NO", marksheet.registration_no],
    ["SEMESTER", marksheet.semester_label, "MONTH & YEAR OF THE EXAMINATION", marksheet.exam_month_year],
  ];

  doc.setFontSize(11.5);
  doc.setFont("times", "normal");
  let maxL1Width = 0;
  for (const row of rows) {
    maxL1Width = Math.max(maxL1Width, doc.getTextWidth(row[0]));
  }

  const col1ValueX = col1X + maxL1Width + 18;
  let currentY = y;

  for (let i = 0; i < rows.length; i++) {
    const [l1, v1, l2, v2] = rows[i];

    const rightValue = v2;
    const rightLabel = `${l2} : `;
    doc.setFont("times", "bold");
    const rightValueWidth = doc.getTextWidth(rightValue);
    doc.setFont("times", "normal");
    const rightLabelWidth = doc.getTextWidth(rightLabel);

    // Max width for the left value so it doesn't overlap with the right column
    const maxV1Width = (x + width) - rightValueWidth - rightLabelWidth - col1ValueX - 10;

    doc.setFont("times", "bold");
    const v1Lines = fitLines(doc, v1, maxV1Width, 3);

    // Left Column
    doc.setFont("times", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(l1, col1X, currentY);
    doc.text(":", col1ValueX - 10, currentY);
    doc.setFont("times", "bold");
    doc.text(v1Lines, col1ValueX, currentY);

    // Right Column (Aligning from the right edge)
    doc.text(rightValue, x + width, currentY, { align: "right" });
    doc.setFont("times", "normal");
    doc.text(rightLabel, x + width - rightValueWidth - 2, currentY, { align: "right" });

    currentY += baseRowHeight + (v1Lines.length - 1) * 14;
  }

  return currentY;
}

function drawMarksTable(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
) {
  const widths = [32, 72, 202, 55, 55, 56, width - 472];
  const headers = [
    "SL\nNo.",
    "COURSE\nCODE",
    "COURSE TITLE",
    "COURSE\nCREDITS",
    "CREDITS\nEARNED",
    "GRADE\nOBTAINED",
    "GRADE\nPOINTS",
  ];

  drawTableRow(doc, x, y, widths, headers, 24, {
    fontSize: 7.9,
    boldIndexes: [0, 1, 2, 3, 4, 5, 6],
    maxLines: [2, 2, 1, 2, 2, 2, 2],
  });
  y += 24;

  for (const group of groupCoursesBySection(marksheet.courses)) {
    setStroke(doc);
    doc.rect(x, y, width, 15, "S");
    doc.setFont("times", "bold");
    const isPractical = group.section.trim().toLowerCase().includes("practical");
    doc.setFontSize(isPractical ? 9.5 : 13.5);
    setText(doc, isPractical ? BLACK : RED);
    const displayText = isPractical ? "Practical" : group.section;
    doc.text(displayText, isPractical ? x + 4 : x + width / 2, y + 11.5, {
      align: isPractical ? "left" : "center",
    });
    y += 15;

    for (const course of group.courses) {
      let displayTitle = course.course_title;

      const titleLines = fitLines(doc, displayTitle, widths[2] - 7, 3);
      const rowHeight = titleLines.length > 2 ? 30 : titleLines.length > 1 ? 24 : 18;

      drawTableRow(
        doc,
        x,
        y,
        widths,
        [
          String(course.sl_no),
          course.course_code,
          displayTitle,
          formatNumber(course.course_credits),
          formatNumber(course.credits_earned),
          course.grade_obtained,
          formatNumber(course.grade_points),
        ],
        rowHeight,
        {
          fontSize: 8.2,
          boldIndexes: [],
          alignments: ["center", "center", "left", "center", "center", "center", "center"],
          maxLines: [1, 1, 3, 1, 1, 1, 1],
        },
      );
      y += rowHeight;
    }
  }

  drawTableRow(
    doc,
    x,
    y,
    widths,
    [
      "",
      "",
      "TOTAL",
      formatNumber(marksheet.total_credits),
      formatNumber(marksheet.total_credits_earned),
      "",
      "",
    ],
    20,
    {
      fontSize: 11,
      boldIndexes: [2],
      redIndexes: [2],
      alignments: ["center", "center", "right", "center", "center", "center", "center"],
      maxLines: [1, 1, 1, 1, 1, 1, 1],
    },
  );

  return y + 20;
}

function drawTotals(doc: jsPDF, marksheet: StudentMarksheet, x: number, y: number, width: number) {
  const height = 48;
  const gradeWidth = 116;
  setStroke(doc);
  doc.rect(x, y, width, height);
  doc.line(x, y + height / 2, x + width, y + height / 2);
  doc.line(x + width - gradeWidth, y, x + width - gradeWidth, y + height);

  doc.setFont("times", "bold");
  doc.setFontSize(12.5);

  // Row 1: TOTAL CREDIT POINTS
  setText(doc, RED);
  const label1 = "TOTAL CREDIT POINTS = ";
  doc.text(label1, x + 7, y + 16);
  setText(doc, DARK);
  doc.text(formatNumber(marksheet.total_credit_points), x + 7 + doc.getTextWidth(label1), y + 16);

  // Row 2: SGPA and GRADE
  setText(doc, RED);
  const label2 = "SEMESTER GRADE POINT AVERAGE = ";
  doc.text(label2, x + 7, y + 36);
  setText(doc, DARK);
  const val2 = `${formatNumber(marksheet.total_credit_points)} / ${formatNumber(marksheet.total_credits)} = ${formatNumber(marksheet.sgpa)}`;
  doc.text(val2, x + 7 + doc.getTextWidth(label2), y + 36);

  // GRADE (Aligned with Row 2 only)
  setText(doc, RED);
  doc.text("GRADE :", x + width - gradeWidth + 12, y + 36);
  setText(doc, DARK);
  doc.text(marksheet.final_grade, x + width - gradeWidth + 80, y + 36);

  return y + height;
}

function drawFirstPageFooter(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    seal: LoadedDataUrl | null;
    embossedSeal: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
  },
  yEnd: number,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  setText(doc, DARK);
  doc.text(`Date : ${formatDate(marksheet.issue_date || new Date().toISOString())}`, pageWidth / 2, yEnd + 18, {
    align: "center",
  });

  if (images.seal) doc.addImage(images.seal.dataUrl, images.seal.type, 32, 705, 96, 96);
  if (images.embossedSeal) {
    doc.addImage(images.embossedSeal.dataUrl, images.embossedSeal.type, 448, 672, 64, 64);
  }
  if (images.rightSignature) {
    const isAfterJuly24 = isMarksheetAfterJuly2024(marksheet);
    const sigX = isAfterJuly24 ? 375 : 390;
    const sigY = isAfterJuly24 ? 735 : 742;
    const sigW = isAfterJuly24 ? 210 : 180;
    const sigH = isAfterJuly24 ? 93 : 80;
    doc.addImage(images.rightSignature.dataUrl, images.rightSignature.type, sigX, sigY, sigW, sigH);
  }
}

function drawBackgroundTheme(
  doc: jsPDF,
  background: LoadedDataUrl | null,
  pageWidth: number,
  pageHeight: number,
) {
  if (background) {
    doc.addImage(background.dataUrl, background.type, 0, 0, pageWidth, pageHeight);
  } else {
    doc.setFillColor(246, 243, 235);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }
}

function drawTableRow(
  doc: jsPDF,
  x: number,
  y: number,
  widths: number[],
  values: string[],
  height: number,
  options: {
    fontSize: number;
    boldIndexes?: number[];
    redIndexes?: number[];
    alignments?: Array<"left" | "center" | "right">;
    maxLines?: number[];
  },
) {
  let cursorX = x;
  for (const [index, value] of values.entries()) {
    const width = widths[index];
    setStroke(doc);
    doc.rect(cursorX, y, width, height);

    const isBold = options.boldIndexes?.includes(index) ?? false;
    doc.setFont("times", isBold ? "bold" : "normal");
    doc.setFontSize(options.fontSize);
    setText(doc, options.redIndexes?.includes(index) ? RED : DARK);

    const align = options.alignments?.[index] ?? "center";
    const maxLines = options.maxLines?.[index] ?? 2;
    const lines = fitLines(doc, value, width - 7, maxLines);
    const lineHeight = options.fontSize + 1.4;
    const textY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + options.fontSize / 3;
    const textX =
      align === "left" ? cursorX + 4 : align === "right" ? cursorX + width - 4 : cursorX + width / 2;
    doc.text(lines, textX, textY, { align });
    cursorX += width;
  }
}

function drawRowWithoutBorders(
  doc: jsPDF,
  x: number,
  y: number,
  widths: number[],
  values: string[],
  height: number,
  options: {
    fontSize: number;
    boldIndexes?: number[];
    redIndexes?: number[];
    alignments?: Array<"left" | "center" | "right">;
    maxLines?: number[];
  },
) {
  let cursorX = x;
  for (const [index, value] of values.entries()) {
    const width = widths[index];
    const isBold = options.boldIndexes?.includes(index) ?? false;
    doc.setFont("times", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? options.fontSize : options.fontSize - 1.6);
    setText(doc, options.redIndexes?.includes(index) ? RED : DARK);

    const align = options.alignments?.[index] ?? "center";
    const maxLines = options.maxLines?.[index] ?? 2;
    const lines = fitLines(doc, value, width - 7, maxLines);
    const lineHeight = options.fontSize + 1.4;
    const textY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + options.fontSize / 3;
    const textX =
      align === "left" ? cursorX + 4 : align === "right" ? cursorX + width - 4 : cursorX + width / 2;
    doc.text(lines, textX, textY, { align });
    cursorX += width;
  }
}

function fitLines(doc: jsPDF, value: string, width: number, maxLines: number) {
  const lines = doc.splitTextToSize(String(value ?? ""), width) as string[];
  if (lines.length <= maxLines) return lines;

  const next = lines.slice(0, maxLines);
  let last = next[maxLines - 1] ?? "";
  while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) {
    last = last.slice(0, -1);
  }
  next[maxLines - 1] = `${last.trimEnd()}...`;
  return next;
}

function drawPhotoBox(doc: jsPDF, x: number, y: number, width: number, height: number) {
  setStroke(doc);
  doc.rect(x, y, width, height);
  doc.setFont("times", "normal");
  doc.setFontSize(6.5);
  setText(doc, DARK);
  doc.text("Student Photo", x + width / 2, y + height / 2, { align: "center" });
}

function drawCenteredTextFit(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  preferredSize: number,
  minimumSize: number,
) {
  let fontSize = preferredSize;
  doc.setFontSize(fontSize);
  while (fontSize > minimumSize && doc.getTextWidth(text) > width) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  doc.text(text, x, y, { align: "center" });
}

async function loadDataUrl(
  url: string,
  options: { dropLightBackground?: boolean; trimEdges?: number } = {},
): Promise<LoadedDataUrl | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    let dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (options.trimEdges && options.trimEdges > 0) {
      dataUrl = await trimImageEdges(dataUrl, options.trimEdges);
    }
    if (options.dropLightBackground) {
      dataUrl = await removeLightBackground(dataUrl);
    }
    return { dataUrl, type: pdfImageType(blob.type, url) };
  } catch {
    return null;
  }
}

async function generateDynamicQrDataUrl(marksheet: StudentMarksheet): Promise<LoadedDataUrl | null> {
  try {
    const base =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://example.com";
    const qrUrl = new URL("/gradecard/download", base);
    qrUrl.searchParams.set("reg", marksheet.registration_no);
    const dataUrl = await QRCode.toDataURL(qrUrl.toString(), {
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#1a1a1a", light: "#f6f1e4" },
      width: 180,
    });
    return { dataUrl, type: "PNG" };
  } catch {
    return null;
  }
}

async function trimImageEdges(source: string, trimPx: number): Promise<string> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(source);
        return;
      }
      const t = Math.min(trimPx, Math.floor(img.width / 6), Math.floor(img.height / 6));
      const sw = Math.max(1, img.width - t * 2);
      const sh = Math.max(1, img.height - t * 2);
      ctx.drawImage(img, t, t, sw, sh, 0, 0, img.width, img.height);
      const edgeClear = 2;
      ctx.clearRect(0, 0, img.width, edgeClear);
      ctx.clearRect(0, img.height - edgeClear, img.width, edgeClear);
      ctx.clearRect(0, 0, edgeClear, img.height);
      ctx.clearRect(img.width - edgeClear, 0, edgeClear, img.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(source);
    img.src = source;
  });
}

async function removeLightBackground(source: string): Promise<string> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(source);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const isNearWhite = max > 195 && min > 185 && max - min < 30;
        if (isNearWhite) data[i + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(source);
    img.src = source;
  });
}

function pdfImageType(contentType: string, url: string): LoadedDataUrl["type"] {
  if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.jpe?g($|\?)/i.test(url)) {
    return "JPEG";
  }
  if (contentType.includes("webp") || /\.webp($|\?)/i.test(url)) return "WEBP";
  return "PNG";
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

function setText(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setStroke(doc: jsPDF) {
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.45);
}
