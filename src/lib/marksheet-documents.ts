import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import {
  formatGradeCardNumber,
  formatProgrammeTitleDisplay,
  formatSemesterDisplay,
  formatSgpa,
  FRONT_PAGE_FOOTER,
  FRONT_PAGE_HEADER,
  getFrontPageHeaderLayout,
  GRADE_CARD_ASSETS,
  resolveGradeCardDisplayId,
} from "./grade-card-constants";
import {
  encodePublicAssetUrl,
  inferPdfImageType,
  prepareEmbossedSeal,
  prepareControllerSignature,
  prepareGradeCardLogo,
  resolveAssetDisplaySrc,
} from "./grade-card-image-processing";
import {
  calculateMarksCardTotals,
  getMarksCardCourseValues,
  marksCardResultLabel,
} from "./marks-card-helpers";
import { supabase } from "@/integrations/supabase/client";

import {
  applyMarksConfigurationToMarksheet,
  fetchMarksConfiguration,
} from "./marks-configuration";
import {
  buildMarksheetFileName,
  groupCoursesBySection,
  prepareCoursesForDisplay,
  type StudentMarksheet,
} from "./marksheet";

const ASSET_PATHS = {
  background: GRADE_CARD_ASSETS.background,
  logo: GRADE_CARD_ASSETS.logo,
  seal: "/templates/assets/gcu-seal.png",
  embossedSeal: GRADE_CARD_ASSETS.embossedSeal,
  rightSignatureOld: GRADE_CARD_ASSETS.rightSignatureOld,
  rightSignatureNew: GRADE_CARD_ASSETS.rightSignatureNew,
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
  width?: number;
  height?: number;
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

  function wipeSlot(slot: (typeof BACK_PAGE_LAYOUT_REF)["slots"]["checkedBy"]) {
    const wipeTop = slot.signatureTop - 2;
    const wipeLeft = slot.centerX - slot.wipe.w / 2;
    const wipeHeight = getBackPageWipeHeightRef(slot);
    doc.rect(wipeLeft, wipeTop, slot.wipe.w, wipeHeight, "F");
  }

  async function drawSlot(
    url: string | null | undefined,
    slot: (typeof BACK_PAGE_LAYOUT_REF)["slots"]["checkedBy"],
    label: string,
  ) {
    if (!url) return false;
    const loaded = await loadDataUrl(url, { dropLightBackground: true });
    if (!loaded) return false;
    const { w, h } = slot.image;
    const boxX = slot.centerX - w / 2;
    const boxY = slot.signatureTop;
    const naturalW = loaded.width ?? w;
    const naturalH = loaded.height ?? h;
    const fitted = fitImageInBox(naturalW, naturalH, boxX, boxY, w, h);
    doc.addImage(loaded.dataUrl, loaded.type, fitted.x, fitted.y, fitted.w, fitted.h);
    doc.setFont("times", "normal");
    doc.setFontSize(slot.label.fontSize);
    setText(doc, DARK);
    const labelY = fitted.y + fitted.h + slot.label.gapAbove + slot.label.fontSize * 0.85;
    doc.text(label, slot.centerX, labelY, { align: "center" });
    return true;
  }

  wipeSlot(BACK_PAGE_LAYOUT_REF.slots.checkedBy);
  wipeSlot(BACK_PAGE_LAYOUT_REF.slots.verifiedBy);

  await drawSlot(signatures.checkedByUrl, BACK_PAGE_LAYOUT_REF.slots.checkedBy, "Checked by");
  await drawSlot(signatures.verifiedByUrl, BACK_PAGE_LAYOUT_REF.slots.verifiedBy, "Verified by");
}

async function loadControllerSignature(url: string): Promise<LoadedDataUrl | null> {
  const dataUrl = await prepareControllerSignature(url);
  if (!dataUrl) return null;
  const size = await measureDataUrlSize(dataUrl);
  return { dataUrl, type: inferPdfImageType(dataUrl), width: size.width, height: size.height };
}

async function loadEmbossedSeal(): Promise<LoadedDataUrl | null> {
  const dataUrl = await prepareEmbossedSeal(ASSET_PATHS.embossedSeal);
  if (!dataUrl) return null;
  const size = await measureDataUrlSize(dataUrl);
  return { dataUrl, type: inferPdfImageType(dataUrl), width: size.width, height: size.height };
}

async function loadGradeCardLogo(): Promise<LoadedDataUrl | null> {
  const prepared = await prepareGradeCardLogo(ASSET_PATHS.logo);
  if (!prepared) return null;
  return {
    dataUrl: prepared.dataUrl,
    type: inferPdfImageType(prepared.dataUrl),
    width: prepared.width,
    height: prepared.height,
  };
}

async function loadMarksheetPdfAssets(photoUrl?: string | null) {
  const [background, logo, seal, embossedSeal, rightSignatureOld, rightSignatureNew, backPage, photo] =
    await Promise.all([
      loadDataUrl(ASSET_PATHS.background),
      loadGradeCardLogo(),
      loadDataUrl(ASSET_PATHS.seal, { dropLightBackground: true }),
      loadEmbossedSeal(),
      loadControllerSignature(ASSET_PATHS.rightSignatureOld),
      loadControllerSignature(ASSET_PATHS.rightSignatureNew),
      loadDataUrl(ASSET_PATHS.backPage),
      photoUrl
        ? loadDataUrl(photoUrl, { dropLightBackground: true, trimEdges: 18 })
        : Promise.resolve(null),
    ]);

  return {
    background,
    logo,
    seal,
    embossedSeal,
    rightSignatureOld,
    rightSignatureNew,
    backPage,
    photo,
  };
}

function sortMarksheetsBySemester(marksheets: StudentMarksheet[]) {
  const semesterOrder: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  };
  return [...marksheets].sort((a, b) => {
    const normA = (a.semester_label || "").trim().toUpperCase().replace(/^SEM\s+/, "");
    const normB = (b.semester_label || "").trim().toUpperCase().replace(/^SEM\s+/, "");
    return (semesterOrder[normA] ?? 99) - (semesterOrder[normB] ?? 99);
  });
}

async function appendBackPage(
  doc: jsPDF,
  backPage: LoadedDataUrl | null,
  signatures: BackPageSignatureOptions,
) {
  if (!backPage) return;
  doc.addPage();
  doc.addImage(
    backPage.dataUrl,
    backPage.type,
    0,
    0,
    doc.internal.pageSize.getWidth(),
    doc.internal.pageSize.getHeight(),
  );
  await drawBackPageSignatures(doc, signatures);
}

export async function generateMarksheetPdf(
  marksheet: StudentMarksheet,
  options: MarksheetDocumentOptions = {},
) {
  const config = await fetchMarksConfiguration(supabase);
  const enrichedMarksheet = applyMarksConfigurationToMarksheet(marksheet, config);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const qr = await generateDynamicQrDataUrl(enrichedMarksheet);
  const assets = await loadMarksheetPdfAssets(options.photoUrl);
  const rightSignature = isMarksheetAfterJuly2024(marksheet)
    ? assets.rightSignatureNew
    : assets.rightSignatureOld;

  drawMarksheetPage(
    doc,
    enrichedMarksheet,
    {
      background: assets.background,
      logo: assets.logo,
      qr,
      seal: assets.seal,
      embossedSeal: assets.embossedSeal,
      rightSignature,
      photo: assets.photo,
    },
    options,
  );

  await appendBackPage(doc, assets.backPage, options.backPageSignatures ?? {});
  return doc.output("blob");
}

export async function generateAllSemestersPdf(
  marksheets: StudentMarksheet[],
  options: MarksheetDocumentOptions = {},
) {
  if (marksheets.length === 0) {
    throw new Error("No grade card data to generate.");
  }

  const config = await fetchMarksConfiguration(supabase);
  const enrichedMarksheets = marksheets.map((sheet) =>
    applyMarksConfigurationToMarksheet(sheet, config),
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const assets = await loadMarksheetPdfAssets(options.photoUrl);
  const sorted = sortMarksheetsBySemester(enrichedMarksheets);

  for (let i = 0; i < sorted.length; i++) {
    const marksheet = sorted[i];
    if (i > 0) doc.addPage();

    const qr = await generateDynamicQrDataUrl(marksheet);
    const rightSignature = isMarksheetAfterJuly2024(marksheet)
      ? assets.rightSignatureNew
      : assets.rightSignatureOld;

    drawMarksheetPage(
      doc,
      marksheet,
      {
        background: assets.background,
        logo: assets.logo,
        qr,
        seal: assets.seal,
        embossedSeal: assets.embossedSeal,
        rightSignature,
        photo: assets.photo,
      },
      { ...options, allMarksheets: sorted },
    );
  }

  await appendBackPage(doc, assets.backPage, options.backPageSignatures ?? {});
  return doc.output("blob");
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

  y = FRONT_PAGE_HEADER.schoolNameTop;
  doc.setFont("times", "bold");
  doc.setFontSize(14.5);
  setText(doc, RED);
  drawCenteredTextFit(doc, marksheet.school_name, pageWidth / 2, y, width - 20, 14.5, 11);

  y = FRONT_PAGE_HEADER.detailsTop;
  y = drawDetailsTable(doc, marksheet, x, y, width);

  y = FRONT_PAGE_HEADER.gradeCardTitleTop;
  setStroke(doc);
  doc.rect(x, y, width, 18, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  setText(doc, RED);
  doc.text("GRADE CARD", pageWidth / 2, y + 13, { align: "center" });

  y = FRONT_PAGE_HEADER.tableTop;
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
  _x: number,
  _y: number,
  _width: number,
) {
  const headerLayout = getFrontPageHeaderLayout(doc.internal.pageSize.getWidth());

  doc.setFont("times", "bold");
  doc.setFontSize(FRONT_PAGE_HEADER.uniqueIdFontSize);
  setText(doc, DARK);
  const uniqueId = resolveGradeCardDisplayId(marksheet);
  doc.text(
    uniqueId,
    headerLayout.qr.left + headerLayout.qr.size / 2,
    headerLayout.uniqueId.top + FRONT_PAGE_HEADER.uniqueIdFontSize,
    { align: "center" },
  );
  if (images.qr) {
    doc.addImage(
      images.qr.dataUrl,
      images.qr.type,
      headerLayout.qr.left,
      headerLayout.qr.top,
      headerLayout.qr.size,
      headerLayout.qr.size,
    );
  }

  if (images.logo) {
    const { logo } = headerLayout;
    const naturalW = images.logo.width ?? logo.width;
    const naturalH = images.logo.height ?? logo.height;
    const fitted = fitImageInBox(naturalW, naturalH, logo.left, logo.top, logo.width, logo.height);
    doc.addImage(
      images.logo.dataUrl,
      images.logo.type,
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
    );
  }

  if (images.photo) {
    const { photo } = headerLayout;
    doc.addImage(
      images.photo.dataUrl,
      images.photo.type,
      photo.left,
      photo.top,
      photo.width,
      photo.height,
    );
  } else {
    drawPhotoBox(
      doc,
      headerLayout.photo.left,
      headerLayout.photo.top,
      headerLayout.photo.width,
      headerLayout.photo.height,
    );
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
    ["PROGRAMME TITLE", formatProgrammeTitleDisplay(marksheet.programme_title), "PROGRAMME CODE", marksheet.programme_code],
    ["NAME OF THE STUDENT", marksheet.student_name, "REGISTRATION NO", marksheet.registration_no],
    ["SEMESTER", formatSemesterDisplay(marksheet.semester_label), "MONTH & YEAR OF THE EXAMINATION", marksheet.exam_month_year],
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
    const v1Lines = fitLines(doc, v1, maxV1Width, i === 0 ? 2 : 3);

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
  const val2 = `${formatNumber(marksheet.total_credit_points)} / ${formatNumber(marksheet.total_credits)} = ${formatSgpa(marksheet.sgpa)}`;
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
    const sig = isAfterJuly24 ? FRONT_PAGE_FOOTER.signatureNew : FRONT_PAGE_FOOTER.signatureOld;
    const naturalW = images.rightSignature.width ?? sig.w;
    const naturalH = images.rightSignature.height ?? sig.h;
    const fitted = fitImageInBox(naturalW, naturalH, sig.x, sig.y, sig.w, sig.h);
    doc.addImage(
      images.rightSignature.dataUrl,
      images.rightSignature.type,
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
    );
  }
}

function drawBackgroundTheme(
  doc: jsPDF,
  _background: LoadedDataUrl | null,
  pageWidth: number,
  pageHeight: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
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
    /** Marks-card cells use tighter vertical centring (grade card unchanged). */
    marksCardLayout?: boolean;
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
    const lineHeight = options.marksCardLayout ? options.fontSize * 1.15 : options.fontSize + 1.4;
    const blockHeight = lines.length * lineHeight;
    const textY = options.marksCardLayout
      ? y + (height - blockHeight) / 2 + options.fontSize * 0.78
      : y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + options.fontSize / 3;
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
    const fetchUrl = url.startsWith("/") ? encodePublicAssetUrl(url) : url;
    const response = await fetch(fetchUrl);
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
    const size = await measureDataUrlSize(dataUrl);
    return {
      dataUrl,
      type: inferPdfImageType(dataUrl),
      width: size.width,
      height: size.height,
    };
  } catch {
    return null;
  }
}

function measureDataUrlSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

function fitImageInBox(
  naturalW: number,
  naturalH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
) {
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const drawW = naturalW * scale;
  const drawH = naturalH * scale;
  return {
    x: boxX + (boxW - drawW) / 2,
    y: boxY + (boxH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
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
    return { dataUrl, type: inferPdfImageType(dataUrl) };
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

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value: number) {
  return formatGradeCardNumber(value);
}

function setText(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setStroke(doc: jsPDF) {
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.45);
}

/** Column weights from official marks card template (scaled to content width). */
const MARKS_CARD_COL_RATIOS = [24, 50, 118, 46, 28, 28, 28, 28, 28, 28, 34] as const;

/** Marks-card-only layout — vertical gaps matched to official sample PDF (grade card unchanged). */
const MARKS_CARD_LAYOUT = {
  headerBandBottom: FRONT_PAGE_HEADER.rowTop + FRONT_PAGE_HEADER.rowHeight,
  /** QR/photo row → school name (~40–50pt in sample). */
  schoolNameGapAbove: 20,
  /** School name → student details (largest gap in sample, ~60–70pt). */
  schoolNameGapBelow: 56,
  schoolNameFontSize: 14.5,
  schoolNameBaselineOffset: 0.85,
  detailsFontSize: 11.5,
  detailsLineHeight: 1.15,
  detailsRowGap: 8,
  /** Student details → MARKS CARD table (~one line height in sample). */
  beforeTitleGap: 10,
  /** Table title row — smaller than school name (official sample ~11pt). */
  titleBarHeight: 13,
  titleFontSize: 11,
  tableHeaderRow1: 18,
  tableHeaderRow2: 15,
  tableBodyRow: 14,
  tableBodyRowWrap: 17,
  tableSummaryRow: 14,
  tableHeaderFont: 7.1,
  tableBodyFont: 7.4,
  tableSummaryFont: 7.4,
  /** Table bottom → centred date (~22pt in sample). */
  afterTableGap: 22,
  dateFontSize: 11.5,
  /** Date → abbreviation legend (~30pt in sample). */
  dateToLegendGap: 22,
  legendFontSize: 9.5,
  /** Vertical gap between CIA/ESE row and RA/P row in legend. */
  legendRowGap: 18,
  legendPadX: 4,
  /** Left edge of ESE / P column (aligned with each other, official sample). */
  legendRightColRatio: 0.52,
  sealLabelFontSize: 10,
  /** Nudge seal graphic right so it centres over the "SEAL" label. */
  sealImageOffsetX: 12,
  /** Gap from bottom of seal image to top of "SEAL" label (~½ seal height in sample). */
  sealLabelGap: 14,
} as const;

function marksCardColumnWidths(contentWidth: number) {
  const total = MARKS_CARD_COL_RATIOS.reduce((sum, value) => sum + value, 0);
  return MARKS_CARD_COL_RATIOS.map((value) => (value / total) * contentWidth);
}

export async function generateMarksCardPdf(
  marksheet: StudentMarksheet,
  options: Pick<MarksheetDocumentOptions, "photoUrl"> = {},
) {
  if (!marksheet?.courses?.length) {
    throw new Error("No marks card data to generate.");
  }

  const config = await fetchMarksConfiguration(supabase);
  const enrichedMarksheet = applyMarksConfigurationToMarksheet(marksheet, config);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const qr = await generateDynamicQrDataUrl(enrichedMarksheet);
  const assets = await loadMarksheetPdfAssets(options.photoUrl);
  const rightSignature = isMarksheetAfterJuly2024(enrichedMarksheet)
    ? assets.rightSignatureNew
    : assets.rightSignatureOld;

  drawMarksCardPage(doc, enrichedMarksheet, {
    background: assets.background,
    logo: assets.logo,
    qr,
    seal: assets.seal,
    rightSignature,
    photo: assets.photo,
  });

  return doc.output("blob");
}

export async function generateAllMarksCardsPdf(
  marksheets: StudentMarksheet[],
  options: Pick<MarksheetDocumentOptions, "photoUrl"> = {},
) {
  const withCourses = marksheets.filter((sheet) => (sheet.courses?.length ?? 0) > 0);
  if (withCourses.length === 0) {
    throw new Error("No marks card data to generate.");
  }

  const config = await fetchMarksConfiguration(supabase);
  const enrichedSheets = withCourses.map((sheet) =>
    applyMarksConfigurationToMarksheet(sheet, config),
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const assets = await loadMarksheetPdfAssets(options.photoUrl);
  const sorted = sortMarksheetsBySemester(enrichedSheets);

  for (let i = 0; i < sorted.length; i++) {
    const marksheet = sorted[i]!;
    if (i > 0) doc.addPage();

    const qr = await generateDynamicQrDataUrl(marksheet);
    const rightSignature = isMarksheetAfterJuly2024(marksheet)
      ? assets.rightSignatureNew
      : assets.rightSignatureOld;

    drawMarksCardPage(doc, marksheet, {
      background: assets.background,
      logo: assets.logo,
      qr,
      seal: assets.seal,
      rightSignature,
      photo: assets.photo,
    });
  }

  return doc.output("blob");
}

export function downloadMarksCardBlob(marksheet: StudentMarksheet, blob: Blob) {
  const studentSlug = marksheet.student_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const semSlug = String(marksheet.semester_label || "semester")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  downloadBlob(blob, `MarksCard_${studentSlug}_${semSlug}.pdf`);
}

export function downloadAllMarksCardsBlob(blob: Blob, rollNo: string) {
  downloadBlob(blob, `MarksCard_AllSemesters_${rollNo}.pdf`);
}

/** Plain white page — marks card only (grade card keeps themed background). */
function drawMarksCardWhiteBackground(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
}

/** QR, grade-card id, and student photo — no university logo (marks card only). */
function drawMarksCardHeader(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    qr: LoadedDataUrl | null;
    photo: LoadedDataUrl | null;
  },
) {
  const headerLayout = getFrontPageHeaderLayout(doc.internal.pageSize.getWidth());

  doc.setFont("times", "bold");
  doc.setFontSize(FRONT_PAGE_HEADER.uniqueIdFontSize);
  setText(doc, DARK);
  const uniqueId = resolveGradeCardDisplayId(marksheet);
  doc.text(
    uniqueId,
    headerLayout.qr.left + headerLayout.qr.size / 2,
    headerLayout.uniqueId.top + FRONT_PAGE_HEADER.uniqueIdFontSize,
    { align: "center" },
  );
  if (images.qr) {
    doc.addImage(
      images.qr.dataUrl,
      images.qr.type,
      headerLayout.qr.left,
      headerLayout.qr.top,
      headerLayout.qr.size,
      headerLayout.qr.size,
    );
  }

  const { photo } = headerLayout;
  if (images.photo) {
    doc.addImage(
      images.photo.dataUrl,
      images.photo.type,
      photo.left,
      photo.top,
      photo.width,
      photo.height,
    );
  } else {
    drawPhotoBox(doc, photo.left, photo.top, photo.width, photo.height);
  }
  setStroke(doc);
  doc.rect(photo.left, photo.top, photo.width, photo.height, "S");
}

function drawMarksCardPage(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    background: LoadedDataUrl | null;
    logo: LoadedDataUrl | null;
    qr: LoadedDataUrl | null;
    seal: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
    photo: LoadedDataUrl | null;
  },
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = FRONT_PAGE_HEADER.contentX;
  const width = pageWidth - x * 2;

  drawMarksCardWhiteBackground(doc, pageWidth, pageHeight);
  setStroke(doc);
  drawMarksCardHeader(doc, marksheet, { qr: images.qr, photo: images.photo });

  const schoolBaseline =
    MARKS_CARD_LAYOUT.headerBandBottom +
    MARKS_CARD_LAYOUT.schoolNameGapAbove +
    MARKS_CARD_LAYOUT.schoolNameFontSize * MARKS_CARD_LAYOUT.schoolNameBaselineOffset;

  doc.setFont("times", "bold");
  doc.setFontSize(MARKS_CARD_LAYOUT.schoolNameFontSize);
  setText(doc, RED);
  drawCenteredTextFit(
    doc,
    marksheet.school_name,
    pageWidth / 2,
    schoolBaseline,
    width - 20,
    MARKS_CARD_LAYOUT.schoolNameFontSize,
    11,
  );

  let y =
    schoolBaseline +
    MARKS_CARD_LAYOUT.schoolNameFontSize +
    MARKS_CARD_LAYOUT.schoolNameGapBelow;
  y = drawMarksCardDetailsTable(doc, marksheet, x, y, width);
  y += MARKS_CARD_LAYOUT.beforeTitleGap;

  y = drawMarksCardTable(doc, marksheet, x, y, width, pageWidth);
  y = drawMarksCardPostTableSection(doc, marksheet, x, y, width, pageWidth);
  drawMarksCardFooter(doc, marksheet, images);
}

/** Student block — colons aligned, spacing matches official marks card sample. */
function drawMarksCardDetailsTable(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
) {
  const fontSize = MARKS_CARD_LAYOUT.detailsFontSize;
  const lineHeight = fontSize * MARKS_CARD_LAYOUT.detailsLineHeight;
  const rowGap = MARKS_CARD_LAYOUT.detailsRowGap;

  const rows = [
    [
      "PROGRAMME TITLE",
      formatProgrammeTitleDisplay(marksheet.programme_title),
      "PROGRAMME CODE",
      marksheet.programme_code,
      2,
    ],
    ["NAME OF THE STUDENT", marksheet.student_name, "REGISTRATION NO", marksheet.registration_no, 3],
    [
      "SEMESTER",
      formatSemesterDisplay(marksheet.semester_label),
      "MONTH & YEAR OF THE EXAMINATION",
      marksheet.exam_month_year,
      3,
    ],
  ] as const;

  doc.setFontSize(fontSize);
  doc.setFont("times", "normal");
  let maxLeftLabelW = 0;
  for (const [leftLabel] of rows) {
    maxLeftLabelW = Math.max(maxLeftLabelW, doc.getTextWidth(leftLabel));
  }

  const leftColonX = x + maxLeftLabelW + 4;
  const leftValueX = leftColonX + doc.getTextWidth(": ") + 2;
  let currentY = y;

  for (const [leftLabel, leftValue, rightLabel, rightValue, maxLines] of rows) {
    const rightLabelColon = `${rightLabel} : `;
    doc.setFont("times", "bold");
    const rightValueWidth = doc.getTextWidth(rightValue);
    doc.setFont("times", "normal");
    const rightLabelColonWidth = doc.getTextWidth(rightLabelColon);
    const maxLeftValueWidth = x + width - rightValueWidth - rightLabelColonWidth - leftValueX - 12;

    doc.setFont("times", "bold");
    const leftValueLines = fitLines(doc, leftValue, maxLeftValueWidth, maxLines);

    doc.setFont("times", "normal");
    setText(doc, DARK);
    doc.text(leftLabel, x, currentY);
    doc.text(":", leftColonX, currentY);
    doc.setFont("times", "bold");
    doc.text(leftValueLines, leftValueX, currentY);

    const rightStartX = x + width - rightLabelColonWidth - rightValueWidth;
    doc.setFont("times", "normal");
    doc.text(rightLabelColon, rightStartX, currentY);
    doc.setFont("times", "bold");
    doc.text(rightValue, rightStartX + rightLabelColonWidth, currentY);

    currentY += lineHeight + (leftValueLines.length - 1) * lineHeight + rowGap;
  }

  return currentY - rowGap;
}

function drawMarksCardTable(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
  pageWidth: number,
) {
  const widths = marksCardColumnWidths(width);
  const titleH = MARKS_CARD_LAYOUT.titleBarHeight;

  setStroke(doc);
  doc.rect(x, y, width, titleH, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(MARKS_CARD_LAYOUT.titleFontSize);
  setText(doc, RED);
  doc.text("MARKS CARD", pageWidth / 2, y + titleH - 4, { align: "center" });
  y += titleH;

  const headerRow1Height = MARKS_CARD_LAYOUT.tableHeaderRow1;
  const headerRow2Height = MARKS_CARD_LAYOUT.tableHeaderRow2;
  drawMarksCardTableHeader(doc, x, y, widths, headerRow1Height, headerRow2Height);
  y += headerRow1Height + headerRow2Height;

  for (const course of prepareCoursesForDisplay(marksheet.courses)) {
    const values = getMarksCardCourseValues(course);
    const titleLines = fitLines(doc, course.course_title, widths[2]! - 8, 2);
    const rowHeight =
      titleLines.length > 1 ? MARKS_CARD_LAYOUT.tableBodyRowWrap : MARKS_CARD_LAYOUT.tableBodyRow;

    drawTableRow(
      doc,
      x,
      y,
      widths,
      [
        String(course.sl_no),
        course.course_code,
        course.course_title.toUpperCase(),
        values.courseType,
        formatGradeCardNumber(values.ciaMax),
        formatGradeCardNumber(values.ciaMin),
        formatGradeCardNumber(values.ciaScored),
        formatGradeCardNumber(values.eseMax),
        formatGradeCardNumber(values.eseMin),
        formatGradeCardNumber(values.eseScored),
        values.status,
      ],
      rowHeight,
      {
        fontSize: MARKS_CARD_LAYOUT.tableBodyFont,
        marksCardLayout: true,
        alignments: ["center", "center", "left", "center", "center", "center", "center", "center", "center", "center", "center"],
        maxLines: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    );
    y += rowHeight;
  }

  const totals = calculateMarksCardTotals(marksheet.courses);
  const resultLabel = marksCardResultLabel(totals.obtained, totals.maxTotal);
  const grandTotalText = `${formatGradeCardNumber(totals.obtained)}/${formatGradeCardNumber(totals.maxTotal)}`;
  const firstFourWidth = widths.slice(0, 4).reduce((sum, value) => sum + value, 0);
  const middleSixWidth = widths.slice(4, 10).reduce((sum, value) => sum + value, 0);
  const statusWidth = widths[10]!;
  const summaryH = MARKS_CARD_LAYOUT.tableSummaryRow;

  drawMarksCardSummaryRow(
    doc,
    x,
    y,
    firstFourWidth,
    middleSixWidth,
    statusWidth,
    summaryH,
    "Grand Total",
    grandTotalText,
    true,
  );
  y += summaryH;

  drawMarksCardSummaryRow(
    doc,
    x,
    y,
    firstFourWidth,
    middleSixWidth,
    statusWidth,
    summaryH,
    "Result",
    resultLabel,
    true,
  );

  return y + summaryH;
}

function drawMarksCardTableHeader(
  doc: jsPDF,
  x: number,
  y: number,
  widths: number[],
  row1Height: number,
  row2Height: number,
) {
  const totalHeight = row1Height + row2Height;
  const colX = (index: number) => x + widths.slice(0, index).reduce((sum, value) => sum + value, 0);
  const colW = (start: number, count: number) =>
    widths.slice(start, start + count).reduce((sum, value) => sum + value, 0);

  const row1Main = ["Sl\nNo.", "Course\nCode", "Course Title", "Course Type"];
  for (let i = 0; i < 4; i++) {
    setStroke(doc);
    doc.rect(colX(i), y, widths[i]!, totalHeight, "S");
    drawMultilineCellText(
      doc,
      row1Main[i]!,
      colX(i),
      y,
      widths[i]!,
      totalHeight,
      MARKS_CARD_LAYOUT.tableHeaderFont,
      true,
    );
  }

  const ciaX = colX(4);
  const ciaW = colW(4, 3);
  setStroke(doc);
  doc.rect(ciaX, y, ciaW, row1Height, "S");
  drawMultilineCellText(doc, "CIA", ciaX, y, ciaW, row1Height, MARKS_CARD_LAYOUT.tableHeaderFont, true);

  const eseX = colX(7);
  const eseW = colW(7, 3);
  setStroke(doc);
  doc.rect(eseX, y, eseW, row1Height, "S");
  drawMultilineCellText(doc, "ESE", eseX, y, eseW, row1Height, MARKS_CARD_LAYOUT.tableHeaderFont, true);

  const statusX = colX(10);
  setStroke(doc);
  doc.rect(statusX, y, widths[10]!, totalHeight, "S");
  drawMultilineCellText(
    doc,
    "Status",
    statusX,
    y,
    widths[10]!,
    totalHeight,
    MARKS_CARD_LAYOUT.tableHeaderFont,
    true,
  );

  const subLabels = ["Max\nMarks", "Min\nMarks", "Marks\nScored", "Max\nMarks", "Min\nMarks", "Marks\nScored"];
  for (let i = 0; i < subLabels.length; i++) {
    const colIndex = 4 + i;
    setStroke(doc);
    doc.rect(colX(colIndex), y + row1Height, widths[colIndex]!, row2Height, "S");
    drawMultilineCellText(
      doc,
      subLabels[i]!,
      colX(colIndex),
      y + row1Height,
      widths[colIndex]!,
      row2Height,
      MARKS_CARD_LAYOUT.tableHeaderFont,
      true,
    );
  }
}

/** Grand Total / Result rows — black labels (right in first 4 cols), value centred in marks cols. */
function drawMarksCardSummaryRow(
  doc: jsPDF,
  x: number,
  y: number,
  labelWidth: number,
  marksWidth: number,
  statusWidth: number,
  height: number,
  label: string,
  value: string,
  includeStatusCell: boolean,
) {
  const fontSize = MARKS_CARD_LAYOUT.tableSummaryFont;
  const textY = y + height / 2 + fontSize / 3;

  setStroke(doc);
  doc.rect(x, y, labelWidth, height, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(fontSize);
  setText(doc, DARK);
  doc.text(label, x + labelWidth - 4, textY, { align: "right" });

  const valueWidth = includeStatusCell ? marksWidth : marksWidth + statusWidth;
  const valueX = x + labelWidth;
  doc.rect(valueX, y, valueWidth, height, "S");
  doc.setFont("times", "bold");
  doc.text(value, valueX + valueWidth / 2, textY, { align: "center" });

  if (includeStatusCell) {
    doc.rect(valueX + valueWidth, y, statusWidth, height, "S");
  }
}

function drawMergedTableRow(
  doc: jsPDF,
  x: number,
  y: number,
  cells: Array<{
    width: number;
    text: string;
    align: "left" | "center" | "right";
    bold?: boolean;
    red?: boolean;
  }>,
  height: number,
  fontSize: number,
) {
  let cursorX = x;
  for (const cell of cells) {
    setStroke(doc);
    doc.rect(cursorX, y, cell.width, height, "S");
    doc.setFont("times", cell.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    setText(doc, cell.red ? RED : DARK);
    const textX =
      cell.align === "left"
        ? cursorX + 4
        : cell.align === "right"
          ? cursorX + cell.width - 4
          : cursorX + cell.width / 2;
    doc.text(cell.text, textX, y + height / 2 + fontSize / 3, { align: cell.align });
    cursorX += cell.width;
  }
}

function drawMultilineCellText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  bold = false,
) {
  doc.setFont("times", bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  setText(doc, DARK);
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.15;
  const blockHeight = lines.length * lineHeight;
  let textY = y + (height - blockHeight) / 2 + fontSize * 0.78;
  for (const line of lines) {
    doc.text(line, x + width / 2, textY, { align: "center" });
    textY += lineHeight;
  }
}

/** One legend line: bold abbreviation + normal " – description" (official sample). */
function drawMarksCardLegendLine(
  doc: jsPDF,
  y: number,
  abbrev: string,
  description: string,
  fontSize: number,
  startX: number,
) {
  doc.setFontSize(fontSize);
  doc.setFont("times", "bold");
  const abbrevW = doc.getTextWidth(abbrev);
  doc.setFont("times", "normal");
  const suffix = ` – ${description}`;

  doc.setFont("times", "bold");
  setText(doc, DARK);
  doc.text(abbrev, startX, y);
  doc.setFont("times", "normal");
  doc.text(suffix, startX + abbrevW, y);
}

/** Centered date, then legend: left CIA/RA, right ESE/P (official marks card sample). */
function drawMarksCardPostTableSection(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
  pageWidth: number,
) {
  y += MARKS_CARD_LAYOUT.afterTableGap;

  doc.setFont("times", "bold");
  doc.setFontSize(MARKS_CARD_LAYOUT.dateFontSize);
  setText(doc, DARK);
  doc.text(
    `Date : ${formatDate(marksheet.issue_date || new Date().toISOString())}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );

  y += MARKS_CARD_LAYOUT.dateToLegendGap + MARKS_CARD_LAYOUT.dateFontSize * 0.35;
  const fontSize = MARKS_CARD_LAYOUT.legendFontSize;
  const rowGap = MARKS_CARD_LAYOUT.legendRowGap;
  const leftX = x + MARKS_CARD_LAYOUT.legendPadX;
  const rightColX = x + width * MARKS_CARD_LAYOUT.legendRightColRatio;
  const legendTop = y;

  drawMarksCardLegendLine(doc, legendTop, "CIA", "Continuous Internal Assessment", fontSize, leftX);
  drawMarksCardLegendLine(doc, legendTop, "ESE", "End Semester Examination", fontSize, rightColX);

  const row2Y = legendTop + rowGap;
  drawMarksCardLegendLine(doc, row2Y, "RA", "Re-appear", fontSize, leftX);
  drawMarksCardLegendLine(doc, row2Y, "P", "Pass", fontSize, rightColX);

  return row2Y + fontSize;
}

/** Seal graphic with "SEAL" centred on the seal bounding box (marks card only). */
function drawMarksCardSealWithLabel(doc: jsPDF, sealImage: LoadedDataUrl | null) {
  const seal = FRONT_PAGE_FOOTER.seal;
  const sealCenterX = seal.x + seal.w / 2;

  if (sealImage) {
    doc.addImage(
      sealImage.dataUrl,
      sealImage.type,
      seal.x + MARKS_CARD_LAYOUT.sealImageOffsetX,
      seal.y,
      seal.w,
      seal.h,
    );
  }

  const label = "SEAL";
  const fontSize = MARKS_CARD_LAYOUT.sealLabelFontSize;
  const labelY = seal.y + seal.h + MARKS_CARD_LAYOUT.sealLabelGap;

  doc.setFont("times", "bold");
  doc.setFontSize(fontSize);
  setText(doc, DARK);
  const labelWidth = doc.getTextWidth(label);
  const labelBaseline = labelY + fontSize * 0.75;
  doc.text(label, sealCenterX - labelWidth / 2, labelBaseline);
}

function drawMarksCardFooter(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    seal: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
  },
) {
  drawMarksCardSealWithLabel(doc, images.seal);

  if (images.rightSignature) {
    const isAfterJuly24 = isMarksheetAfterJuly2024(marksheet);
    const sig = isAfterJuly24 ? FRONT_PAGE_FOOTER.signatureNew : FRONT_PAGE_FOOTER.signatureOld;
    const naturalW = images.rightSignature.width ?? sig.w;
    const naturalH = images.rightSignature.height ?? sig.h;
    const fitted = fitImageInBox(naturalW, naturalH, sig.x, sig.y, sig.w, sig.h);
    doc.addImage(
      images.rightSignature.dataUrl,
      images.rightSignature.type,
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
    );
  }
}
