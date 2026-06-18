import { forwardRef, useEffect, useMemo, useState } from "react";

import { prepareCoursesForDisplay, type StudentMarksheet } from "@/lib/marksheet";
import { buildDocumentQrDataUrl } from "@/lib/qr-document-links";
import {
  calculateMarksCardTotals,
  filterMarksheetForMarksCard,
  getMarksCardCourseValues,
  marksCardSemesterResult,
} from "@/lib/marks-card-helpers";
import {
  A4_HEIGHT,
  A4_WIDTH,
  formatGradeCardDate,
  formatGradeCardNumber,
  formatProgrammeTitleDisplay,
  PROGRAMME_TITLE_MAX_LINES,
  formatSemesterDisplay,
  FRONT_PAGE_FOOTER,
  FRONT_PAGE_HEADER,
  CONTROLLER_SIGNATURE_LABEL,
  getControllerSignatureAsset,
  getControllerSignatureLabelTop,
  getFrontPageHeaderLayout,
  GRADE_CARD_ASSETS,
  GRADE_CARD_COLORS,
  isMarksheetAfterJuly2024,
  resolveGradeCardDisplayId,
} from "@/lib/grade-card-constants";
import {
  loadTransparentAsset,
  prepareControllerSignature,
  prepareGradeCardLogo,
  prepareGradeCardStudentPhoto,
  measureSignatureInkBottomY,
} from "@/lib/grade-card-image-processing";

export type MarksCardTemplateProps = {
  marksheet: StudentMarksheet;
  allMarksheets?: StudentMarksheet[];
  photoUrl?: string | null;
  className?: string;
};

const CONTENT_X = FRONT_PAGE_HEADER.contentX;
const CONTENT_WIDTH = A4_WIDTH - CONTENT_X * 2;

const MARKS_COL_WIDTHS = [24, 50, 118, 46, 28, 28, 28, 28, 28, 28, 34] as const;

/** Matches marksheet-documents MARKS_CARD_LAYOUT.sealImageOffsetX */
const MARKS_CARD_SEAL_IMAGE_OFFSET_X = 12;

export const MarksCardTemplate = forwardRef<HTMLDivElement, MarksCardTemplateProps>(
  function MarksCardTemplate({ marksheet, allMarksheets, photoUrl, className = "" }, ref) {
    const [photoSrc, setPhotoSrc] = useState<string | null>(photoUrl ?? null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [sealSrc, setSealSrc] = useState<string | null>(null);
    const [signatureSrc, setSignatureSrc] = useState<string | null>(null);
    const [signatureInkBottomY, setSignatureInkBottomY] = useState<number | undefined>();
    const [logoSrc, setLogoSrc] = useState<string | null>(null);
    const headerLayout = getFrontPageHeaderLayout();

    const semesterMarksheet = useMemo(
      () =>
        allMarksheets?.length
          ? filterMarksheetForMarksCard(marksheet, allMarksheets)
          : marksheet,
      [marksheet, allMarksheets],
    );
    const displayCourses = useMemo(
      () => prepareCoursesForDisplay(semesterMarksheet.courses),
      [semesterMarksheet.courses],
    );
    const totals = useMemo(() => calculateMarksCardTotals(displayCourses), [displayCourses]);
    const resultLabel = useMemo(
      () => marksCardSemesterResult(displayCourses),
      [displayCourses],
    );

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const prepared = await prepareGradeCardLogo(GRADE_CARD_ASSETS.logo);
        if (cancelled || !prepared) return;
        setLogoSrc(prepared.dataUrl);
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!photoUrl) {
        setPhotoSrc(null);
        return;
      }
      let cancelled = false;
      void (async () => {
        const prepared = await prepareGradeCardStudentPhoto(photoUrl);
        if (!cancelled) setPhotoSrc(prepared ?? photoUrl);
      })();
      return () => {
        cancelled = true;
      };
    }, [photoUrl]);

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        try {
          const dataUrl = await buildDocumentQrDataUrl("marks", marksheet.registration_no, {
            width: 220,
          });
          if (!cancelled) setQrDataUrl(dataUrl);
        } catch {
          if (!cancelled) setQrDataUrl(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [marksheet.registration_no]);

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const sigUrl = getControllerSignatureAsset(marksheet);
        const isNewSig = isMarksheetAfterJuly2024(marksheet);
        const sigLayout = isNewSig ? FRONT_PAGE_FOOTER.signatureNew : FRONT_PAGE_FOOTER.signatureOld;
        const [seal, signature] = await Promise.all([
          loadTransparentAsset(GRADE_CARD_ASSETS.seal),
          prepareControllerSignature(sigUrl),
        ]);
        if (cancelled) return;
        setSealSrc(seal);
        setSignatureSrc(signature);
        if (signature) {
          const inkBottomY = await measureSignatureInkBottomY(signature, sigLayout);
          if (!cancelled) setSignatureInkBottomY(inkBottomY ?? undefined);
        } else {
          setSignatureInkBottomY(undefined);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [marksheet.exam_month_year]);

    const uniqueId = resolveGradeCardDisplayId(marksheet);
    const isNewSig = isMarksheetAfterJuly2024(marksheet);
    const sigLayout = isNewSig ? FRONT_PAGE_FOOTER.signatureNew : FRONT_PAGE_FOOTER.signatureOld;

    return (
      <div
        ref={ref}
        className={`marks-card-page ${className}`}
        data-marks-card-page="front"
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#f6f3eb",
          fontFamily: '"Times New Roman", Times, serif',
          color: GRADE_CARD_COLORS.dark,
          boxSizing: "border-box",
        }}
      >
        <img
          src={GRADE_CARD_ASSETS.background}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            bottom: 14,
            border: `1.2px solid ${GRADE_CARD_COLORS.border}`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16.5,
            left: 16.5,
            right: 16.5,
            bottom: 16.5,
            border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: headerLayout.uniqueId.left,
            top: headerLayout.uniqueId.top,
            width: headerLayout.uniqueId.width,
            textAlign: "center",
            fontSize: FRONT_PAGE_HEADER.uniqueIdFontSize,
            fontWeight: "bold",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {uniqueId}
        </div>
        <div
          style={{
            position: "absolute",
            left: headerLayout.qr.left,
            top: headerLayout.qr.top,
            width: headerLayout.qr.width,
            height: headerLayout.qr.height,
          }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: headerLayout.logo.left,
            top: headerLayout.logo.top,
            width: headerLayout.logo.width,
            height: headerLayout.logo.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logoSrc ?? GRADE_CARD_ASSETS.logo}
            alt="Garden City University"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: headerLayout.photo.left,
            top: headerLayout.photo.top,
            width: headerLayout.photo.width,
            height: headerLayout.photo.height,
            border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="Student"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={() => setPhotoSrc(null)}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 6.5,
                textAlign: "center",
                padding: 4,
              }}
            >
              Student Photo
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            left: CONTENT_X,
            top: FRONT_PAGE_HEADER.schoolNameTop,
            width: CONTENT_WIDTH,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 14.5,
              fontWeight: "bold",
              color: GRADE_CARD_COLORS.red,
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {marksheet.school_name}
          </div>

          <StudentDetailsSection marksheet={semesterMarksheet} />

          <div
            style={{
              marginTop: 10,
              height: 18,
              border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: "bold",
              color: GRADE_CARD_COLORS.red,
            }}
          >
            MARKS CARD
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              fontSize: 7.4,
            }}
          >
            <colgroup>
              {MARKS_COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {[
                  { label: "Sl\nNo.", rowSpan: 2 },
                  { label: "Course\nCode", rowSpan: 2 },
                  { label: "Course Title", rowSpan: 2 },
                  { label: "Course Type", rowSpan: 2 },
                  { label: "CIA", colSpan: 3 },
                  { label: "ESE", colSpan: 3 },
                  { label: "Status", rowSpan: 2 },
                ].map((cell, i) => (
                  <th
                    key={i}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={headerCellStyle()}
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
              <tr>
                {[
                  { key: "cia-max", label: "Max\nMarks" },
                  { key: "cia-min", label: "Min\nMarks" },
                  { key: "cia-scored", label: "Marks\nScored" },
                  { key: "ese-max", label: "Max\nMarks" },
                  { key: "ese-min", label: "Min\nMarks" },
                  { key: "ese-scored", label: "Marks\nScored" },
                ].map(({ key, label }) => (
                  <th key={key} style={headerCellStyle()}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCourses.map((course) => {
                const values = getMarksCardCourseValues(course);
                return (
                  <tr key={`${course.sl_no}-${course.course_code}`}>
                    <td style={cellStyle("center")}>{course.sl_no}</td>
                    <td style={cellStyle("center")}>{course.course_code}</td>
                    <td style={cellStyle("left")}>{course.course_title}</td>
                    <td style={cellStyle("center")}>{values.courseType}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.ciaMax)}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.ciaMin)}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.ciaScored)}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.eseMax)}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.eseMin)}</td>
                    <td style={cellStyle("center")}>{formatGradeCardNumber(values.eseScored)}</td>
                    <td style={cellStyle("center")}>{values.status}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4} style={{ ...cellStyle("right"), fontWeight: "bold" }}>
                  Grand Total
                </td>
                <td colSpan={6} style={{ ...cellStyle("center"), fontWeight: "bold" }}>
                  {formatGradeCardNumber(totals.obtained)}/{formatGradeCardNumber(totals.maxTotal)}
                </td>
                <td style={cellStyle("center")} />
              </tr>
              <tr>
                <td colSpan={4} style={{ ...cellStyle("right"), fontWeight: "bold" }}>
                  Result
                </td>
                <td colSpan={6} style={{ ...cellStyle("center"), fontWeight: "bold" }}>
                  {resultLabel}
                </td>
                <td style={cellStyle("center")} />
              </tr>
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 9.5,
              lineHeight: 1.35,
              paddingLeft: 4,
              paddingRight: 4,
            }}
          >
            <div style={{ flex: "0 0 52%" }}>
              <MarksCardLegendLine abbrev="CIA" description="Continuous Internal Assessment" />
              <div style={{ marginTop: 18 }}>
                <MarksCardLegendLine abbrev="RA" description="Re-appear" />
              </div>
            </div>
            <div>
              <MarksCardLegendLine abbrev="ESE" description="End Semester Examination" />
              <div style={{ marginTop: 18 }}>
                <MarksCardLegendLine abbrev="P" description="Pass" />
              </div>
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 11.5,
              fontWeight: "bold",
              paddingTop: 10,
            }}
          >
            Date : {formatGradeCardDate(marksheet.issue_date || new Date().toISOString())}
          </div>
        </div>

        {(sealSrc ?? GRADE_CARD_ASSETS.seal) && (
          <img
            src={sealSrc ?? GRADE_CARD_ASSETS.seal}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              left: FRONT_PAGE_FOOTER.seal.x + MARKS_CARD_SEAL_IMAGE_OFFSET_X,
              top: FRONT_PAGE_FOOTER.seal.y,
              width: FRONT_PAGE_FOOTER.seal.w,
              height: FRONT_PAGE_FOOTER.seal.h,
              objectFit: "contain",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            left: FRONT_PAGE_FOOTER.seal.x,
            top: FRONT_PAGE_FOOTER.seal.y + FRONT_PAGE_FOOTER.seal.h + 4,
            width: FRONT_PAGE_FOOTER.seal.w,
            textAlign: "center",
            fontSize: 10,
            fontWeight: "bold",
          }}
        >
          SEAL
        </div>

        {signatureSrc && (
          <>
            <img
              src={signatureSrc}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left: sigLayout.x,
                top: sigLayout.y,
                width: sigLayout.w,
                height: sigLayout.h,
                objectFit: "contain",
                objectPosition: "top center",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: sigLayout.x,
                top: getControllerSignatureLabelTop(sigLayout, signatureInkBottomY),
                width: sigLayout.w,
                textAlign: "center",
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: FRONT_PAGE_FOOTER.controllerLabel.fontSize,
                fontWeight: "normal",
                lineHeight: 1,
                color: GRADE_CARD_COLORS.dark,
                whiteSpace: "nowrap",
              }}
            >
              {CONTROLLER_SIGNATURE_LABEL}
            </div>
          </>
        )}
      </div>
    );
  },
);

function MarksCardLegendLine({ abbrev, description }: { abbrev: string; description: string }) {
  return (
    <div>
      <span style={{ fontWeight: "bold" }}>{abbrev}</span>
      <span> – {description}</span>
    </div>
  );
}

function StudentDetailsSection({ marksheet }: { marksheet: StudentMarksheet }) {
  const rows = [
    {
      leftLabel: "PROGRAMME TITLE",
      leftValue: formatProgrammeTitleDisplay(marksheet.programme_title),
      rightLabel: "PROGRAMME CODE",
      rightValue: marksheet.programme_code,
      leftMaxLines: PROGRAMME_TITLE_MAX_LINES as const,
    },
    {
      leftLabel: "NAME OF THE STUDENT",
      leftValue: marksheet.student_name,
      rightLabel: "REGISTRATION NO",
      rightValue: marksheet.registration_no,
    },
    {
      leftLabel: "SEMESTER",
      leftValue: formatSemesterDisplay(marksheet.semester_label),
      rightLabel: "MONTH & YEAR OF THE EXAMINATION",
      rightValue: marksheet.exam_month_year,
    },
  ] as const;

  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.15, marginBottom: 4 }}>
      {rows.map((row) => (
        <DetailRow key={row.leftLabel} {...row} />
      ))}
    </div>
  );
}

function DetailRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  leftMaxLines,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  leftMaxLines?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: "normal", whiteSpace: "nowrap", flexShrink: 0 }}>{leftLabel}</span>
        <span style={{ flexShrink: 0, margin: "0 6px 0 4px" }}>:</span>
        <span
          style={{
            fontWeight: "bold",
            flex: 1,
            minWidth: 0,
            lineHeight: 1.15,
            wordBreak: "break-word",
            overflowWrap: "break-word",
            ...(leftMaxLines
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: leftMaxLines,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }
              : {}),
          }}
        >
          {leftValue}
        </span>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right", lineHeight: 1.15, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: "normal" }}>{rightLabel} : </span>
        <span style={{ fontWeight: "bold" }}>{rightValue}</span>
      </div>
    </div>
  );
}

function headerCellStyle() {
  return {
    border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
    padding: "2px 2px",
    fontWeight: "bold" as const,
    fontSize: 7.1,
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    whiteSpace: "pre-line" as const,
    lineHeight: 1.05,
  };
}

function cellStyle(textAlign: "left" | "center" | "right") {
  return {
    border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
    padding: "2px 3px",
    textAlign,
    verticalAlign: "middle" as const,
    lineHeight: 1.1,
  };
}
