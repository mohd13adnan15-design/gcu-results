import { jsPDF } from "jspdf";

import {
  MARKSHEET_CGPA_SGPA_ROWS,
  MARKSHEET_CREDIT_POINT_EXAMPLES,
  MARKSHEET_EXPLANATION_LINES,
  MARKSHEET_GRADE_SCALE_ROWS,
  buildMarksheetFileName,
  groupCoursesBySection,
  type StudentMarksheet,
} from "./marksheet";

const ASSET_PATHS = {
  logo: "/gcu-logo.png",
  qr: "/templates/assets/gcu-qr.png",
  seal: "/templates/assets/gcu-seal.png",
  centerSignature: "/templates/assets/gcu-footer-signature-center.png",
  rightSignature: "/templates/assets/gcu-footer-signature-right.png",
};

const RED = [122, 17, 17] as const;
const DARK = [20, 20, 20] as const;
const BORDER = [55, 55, 55] as const;
const LIGHT_FILL = [246, 246, 246] as const;

export type MarksheetDocumentOptions = {
  photoUrl?: string | null;
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

export async function generateMarksheetPdf(
  marksheet: StudentMarksheet,
  options: MarksheetDocumentOptions = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const [logo, qr, seal, centerSignature, rightSignature, photo] = await Promise.all([
    loadDataUrl(ASSET_PATHS.logo),
    loadDataUrl(ASSET_PATHS.qr),
    loadDataUrl(ASSET_PATHS.seal),
    loadDataUrl(ASSET_PATHS.centerSignature),
    loadDataUrl(ASSET_PATHS.rightSignature),
    options.photoUrl ? loadDataUrl(options.photoUrl) : Promise.resolve(null),
  ]);

  drawMarksheetPage(doc, marksheet, { logo, qr, seal, centerSignature, rightSignature, photo });
  doc.addPage();
  drawReferencePage(doc);

  return doc.output("blob");
}

export function downloadMarksheetBlob(marksheet: StudentMarksheet, extension: "pdf", blob: Blob) {
  downloadBlob(blob, buildMarksheetFileName(marksheet, extension));
}

function drawMarksheetPage(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    logo: LoadedDataUrl | null;
    qr: LoadedDataUrl | null;
    seal: LoadedDataUrl | null;
    centerSignature: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
    photo: LoadedDataUrl | null;
  },
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = 36;
  const width = pageWidth - x * 2;
  let y = 28;

  setStroke(doc);
  drawHeader(doc, marksheet, images, x, y, width);

  y += 92;
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  setText(doc, RED);
  drawCenteredTextFit(doc, marksheet.school_name, pageWidth / 2, y, width - 20, 11.5, 9.2);

  y += 12;
  y = drawDetailsTable(doc, marksheet, x, y, width);
  y += 12;

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  setText(doc, RED);
  doc.text("GRADE CARD", pageWidth / 2, y, { align: "center" });
  y += 7;
  y = drawMarksTable(doc, marksheet, x, y, width);
  y += 8;
  y = drawTotals(doc, marksheet, x, y, width);

  doc.setFont("times", "normal");
  doc.setFontSize(6.8);
  setText(doc, DARK);
  doc.text(
    "Note: This grade card is valid only with the seal and authorized signatures of the University.",
    pageWidth / 2,
    y + 15,
    { align: "center" },
  );

  drawFirstPageFooter(doc, marksheet, images);
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
  const leftWidth = 82;
  const rightWidth = 82;
  const height = 78;

  setStroke(doc);
  doc.rect(x, y, width, height);
  doc.line(x + leftWidth, y, x + leftWidth, y + height);
  doc.line(x + width - rightWidth, y, x + width - rightWidth, y + height);

  doc.setFont("times", "bold");
  doc.setFontSize(6.5);
  setText(doc, DARK);
  doc.text(marksheet.grade_card_no, x + leftWidth / 2, y + 11, { align: "center" });
  doc.setFontSize(5.8);
  doc.text("GCUBCA", x + leftWidth / 2, y + 22, { align: "center" });
  if (images.qr) doc.addImage(images.qr.dataUrl, images.qr.type, x + 25, y + 27, 40, 40);

  if (images.logo)
    doc.addImage(images.logo.dataUrl, images.logo.type, x + width / 2 - 17, y + 7, 34, 34);
  doc.setFont("times", "bold");
  setText(doc, RED);
  doc.setFontSize(13.2);
  doc.text("GARDEN CITY", x + width / 2, y + 51, { align: "center" });
  doc.setFontSize(14);
  doc.text("UNIVERSITY", x + width / 2, y + 66, { align: "center" });
  doc.setFontSize(5.4);
  setText(doc, DARK);
  doc.text("EMPHASIS ON LIFE", x + width / 2, y + 73, { align: "center" });

  const photoX = x + width - rightWidth + 14;
  if (images.photo) {
    doc.addImage(images.photo.dataUrl, images.photo.type, photoX, y + 6, 54, 66);
  } else {
    drawPhotoBox(doc, photoX, y + 6, 54, 66);
  }
}

function drawDetailsTable(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  x: number,
  y: number,
  width: number,
) {
  const rowHeight = 18;
  const widths = [122, 202, 116, width - 440];
  const rows = [
    ["PROGRAMME TITLE", marksheet.programme_title, "PROGRAMME CODE", marksheet.programme_code],
    ["NAME OF THE STUDENT", marksheet.student_name, "REGISTRATION NO", marksheet.registration_no],
    [
      "SEMESTER",
      marksheet.semester_label,
      "MONTH & YEAR OF THE EXAMINATION",
      marksheet.exam_month_year,
    ],
  ];

  for (const row of rows) {
    drawTableRow(doc, x, y, widths, row, rowHeight, {
      fontSize: 6.8,
      boldIndexes: [0, 1, 2, 3],
      alignments: ["left", "left", "left", "left"],
      maxLines: [1, 2, 2, 1],
    });
    y += rowHeight;
  }

  return y;
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
    fontSize: 6.5,
    boldIndexes: [0, 1, 2, 3, 4, 5, 6],
    maxLines: [2, 2, 1, 2, 2, 2, 2],
  });
  y += 24;

  for (const group of groupCoursesBySection(marksheet.courses)) {
    doc.setFillColor(...LIGHT_FILL);
    setStroke(doc);
    doc.rect(x, y, width, 13, "FD");
    doc.setFont("times", "bold");
    doc.setFontSize(7.3);
    setText(doc, RED);
    doc.text(group.section, x + width / 2, y + 9, { align: "center" });
    y += 13;

    for (const course of group.courses) {
      drawTableRow(
        doc,
        x,
        y,
        widths,
        [
          String(course.sl_no),
          course.course_code,
          course.course_title,
          formatNumber(course.course_credits),
          formatNumber(course.credits_earned),
          course.grade_obtained,
          formatNumber(course.grade_points),
        ],
        22,
        {
          fontSize: 6.4,
          maxLines: [1, 1, 2, 1, 1, 1, 1],
        },
      );
      y += 22;
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
    18,
    {
      fontSize: 7,
      boldIndexes: [2],
      redIndexes: [2],
      maxLines: [1, 1, 1, 1, 1, 1, 1],
    },
  );

  return y + 18;
}

function drawTotals(doc: jsPDF, marksheet: StudentMarksheet, x: number, y: number, width: number) {
  const height = 42;
  const gradeWidth = 108;
  setStroke(doc);
  doc.rect(x, y, width, height);
  doc.line(x + width - gradeWidth, y, x + width - gradeWidth, y + height);

  doc.setFont("times", "bold");
  doc.setFontSize(8.6);
  setText(doc, RED);
  doc.text(`TOTAL CREDIT POINTS = ${formatNumber(marksheet.total_credit_points)}`, x + 7, y + 14);
  doc.text(
    `SEMESTER GRADE POINT AVERAGE = ${formatNumber(marksheet.total_credit_points)} / ${formatNumber(
      marksheet.total_credits,
    )} = ${formatNumber(marksheet.sgpa)}`,
    x + 7,
    y + 30,
  );
  doc.text("GRADE :", x + width - gradeWidth + 16, y + 14);
  doc.setFontSize(10);
  doc.text(marksheet.final_grade, x + width - gradeWidth / 2 + 10, y + 30, { align: "center" });
  return y + height;
}

function drawFirstPageFooter(
  doc: jsPDF,
  marksheet: StudentMarksheet,
  images: {
    seal: LoadedDataUrl | null;
    centerSignature: LoadedDataUrl | null;
    rightSignature: LoadedDataUrl | null;
  },
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  setText(doc, DARK);
  doc.text(`Date : ${formatDate(marksheet.issue_date)}`, pageWidth / 2, 690, { align: "center" });

  if (images.seal) doc.addImage(images.seal.dataUrl, images.seal.type, 42, 724, 58, 58);
  if (images.centerSignature) {
    doc.addImage(images.centerSignature.dataUrl, images.centerSignature.type, 228, 704, 126, 60);
  }
  if (images.rightSignature) {
    doc.addImage(images.rightSignature.dataUrl, images.rightSignature.type, 420, 716, 104, 44);
  }

  doc.setFont("times", "bold");
  doc.setFontSize(8.8);
  setText(doc, DARK);
  doc.text("Controller of Examinations", 292, 780, { align: "center" });
  doc.text("Controller of Examinations", 474, 780, { align: "center" });
}

function drawReferencePage(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = 42;
  const width = pageWidth - x * 2;
  let y = 58;

  setStroke(doc);
  doc.setLineWidth(1.1);
  doc.rect(28, 28, pageWidth - 56, pageHeight - 56);
  doc.setLineWidth(0.55);

  doc.setFont("times", "normal");
  doc.setFontSize(9.2);
  setText(doc, DARK);
  for (const line of MARKSHEET_EXPLANATION_LINES) {
    const lines = doc.splitTextToSize(line, width) as string[];
    doc.text(lines, x, y);
    y += lines.length * 11 + 7;
  }

  y += 6;
  y = drawGradeScaleTable(doc, x, y, width);
  y += 18;

  doc.setFont("times", "normal");
  doc.setFontSize(9.2);
  setText(doc, DARK);
  doc.text(
    "The table below is an illustration of the grades obtained and the calculation of credit points:",
    x,
    y,
  );
  y += 8;
  y = drawCreditPointExampleTable(doc, x, y, width);
  y += 15;

  doc.setFont("times", "bold");
  doc.setFontSize(10.2);
  setText(doc, DARK);
  doc.text("CGPA / SGPA CODE DESCRIPTION", pageWidth / 2, y, { align: "center" });
  y += 9;
  drawCgpaSgpaTable(doc, x + 18, y, width - 36);

  drawReferenceFooter(doc);
}

function drawGradeScaleTable(doc: jsPDF, x: number, y: number, width: number) {
  const widths = [38, 128, 135, 86, width - 387];
  drawTableRow(
    doc,
    x,
    y,
    widths,
    [
      "Sl\nNo.",
      "Percentage of Marks",
      "Description of Grades\nLetter Grade",
      "Grade Points",
      "Description",
    ],
    24,
    { fontSize: 8.8, boldIndexes: [0, 1, 2, 3, 4], maxLines: [2, 1, 2, 1, 1] },
  );
  y += 24;

  for (const row of MARKSHEET_GRADE_SCALE_ROWS) {
    drawTableRow(
      doc,
      x,
      y,
      widths,
      [String(row.slNo), row.marksRange, row.letterGrade, row.gradePoints, row.description],
      18,
      { fontSize: 8.8, maxLines: [1, 1, 1, 1, 1] },
    );
    y += 18;
  }

  return y;
}

function drawCreditPointExampleTable(doc: jsPDF, x: number, y: number, width: number) {
  const widths = [62, 104, 94, 86, width - 346];
  drawTableRow(
    doc,
    x,
    y,
    widths,
    [
      "Course",
      "Grade Obtained",
      "Grade Points",
      "Course Credits",
      "Credit Points\n(Course Credits X Grade Points)",
    ],
    31,
    { fontSize: 8.6, boldIndexes: [0, 1, 2, 3, 4], maxLines: [1, 1, 1, 1, 2] },
  );
  y += 31;

  for (const row of MARKSHEET_CREDIT_POINT_EXAMPLES) {
    drawTableRow(
      doc,
      x,
      y,
      widths,
      [row.course, row.gradeObtained, row.gradePoints, row.courseCredits, row.creditPoints],
      17,
      { fontSize: 8.6, maxLines: [1, 1, 1, 1, 1] },
    );
    y += 17;
  }

  return y;
}

function drawCgpaSgpaTable(doc: jsPDF, x: number, y: number, width: number) {
  const widths = [58, 152, 164, width - 374];
  drawTableRow(doc, x, y, widths, ["SL No", "CGPA / SGPA", "LETTER GRADE", "DESCRIPTION"], 24, {
    fontSize: 8.8,
    boldIndexes: [0, 1, 2, 3],
    maxLines: [1, 1, 1, 1],
  });
  y += 24;

  for (const row of MARKSHEET_CGPA_SGPA_ROWS) {
    drawTableRow(
      doc,
      x,
      y,
      widths,
      [String(row.slNo), row.range, row.letterGrade, row.description],
      18,
      { fontSize: 8.8, maxLines: [1, 1, 1, 1] },
    );
    y += 18;
  }
}

function drawReferenceFooter(doc: jsPDF) {
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  setText(doc, DARK);
  setStroke(doc);

  doc.line(82, 765, 106, 752);
  doc.line(96, 765, 126, 748);
  doc.line(448, 765, 484, 752);
  doc.line(470, 765, 498, 748);

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.text("Checked by", 96, 792, { align: "center" });
  doc.text("Verified by", 476, 792, { align: "center" });
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
    alignments?: Array<"left" | "center">;
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
    const textX = align === "left" ? cursorX + 4 : cursorX + width / 2;
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

async function loadDataUrl(url: string): Promise<LoadedDataUrl | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, type: pdfImageType(blob.type, url) };
  } catch {
    return null;
  }
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
