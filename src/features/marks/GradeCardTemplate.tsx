import { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";

import { groupCoursesBySection, type StudentMarksheet } from "@/lib/marksheet";
import {
  A4_HEIGHT,
  A4_WIDTH,
  BACK_PAGE_LAYOUT,
  getFrontPageHeaderLayout,
  CONTROLLER_SIGNATURE_LABEL,
  formatGradeCardDate,
  formatGradeCardNumber,
  formatProgrammeTitleDisplay,
  formatSemesterDisplay,
  formatSgpa,
  FRONT_PAGE_FOOTER,
  FRONT_PAGE_HEADER,
  getBackPageWipeHeight,
  getControllerSignatureLabelTop,
  getControllerSignatureAsset,
  GRADE_CARD_ASSETS,
  GRADE_CARD_COLORS,
  GRADE_CARD_PAGE_BORDER,
  isMarksheetAfterJuly2024,
  resolveGradeCardDisplayId,
} from "@/lib/grade-card-constants";
import {
  loadTransparentAsset,
  prepareEmbossedSeal,
  prepareControllerSignature,
  prepareGradeCardLogo,
  prepareGradeCardStudentPhoto,
  measureSignatureInkBottomY,
} from "@/lib/grade-card-image-processing";

export type GradeCardTemplateProps = {
  marksheet: StudentMarksheet;
  photoUrl?: string | null;
  className?: string;
};

const TABLE_COL_WIDTHS = [32, 72, 202, 55, 55, 56, 59.28] as const;
const CONTENT_X = FRONT_PAGE_HEADER.contentX;
const CONTENT_WIDTH = A4_WIDTH - CONTENT_X * 2;

export const GradeCardTemplate = forwardRef<HTMLDivElement, GradeCardTemplateProps>(
  function GradeCardTemplate({ marksheet, photoUrl, className = "" }, ref) {
    const [photoSrc, setPhotoSrc] = useState<string | null>(photoUrl ?? null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [sealSrc, setSealSrc] = useState<string | null>(null);
    const [embossedSealSrc, setEmbossedSealSrc] = useState<string | null>(null);
    const [signatureSrc, setSignatureSrc] = useState<string | null>(null);
    const [signatureInkBottomY, setSignatureInkBottomY] = useState<number | undefined>();
    const [logoSrc, setLogoSrc] = useState<string | null>(null);
    const headerLayout = getFrontPageHeaderLayout();

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
          const base =
            typeof window !== "undefined" && window.location.origin
              ? window.location.origin
              : "https://example.com";
          const qrUrl = new URL("/gradecard/download", base);
          qrUrl.searchParams.set("reg", marksheet.registration_no);
          const dataUrl = await QRCode.toDataURL(qrUrl.toString(), {
            errorCorrectionLevel: "M",
            margin: 1,
            color: { dark: "#1a1a1a", light: "#f6f1e4" },
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
        const [seal, embossed, signature] = await Promise.all([
          loadTransparentAsset(GRADE_CARD_ASSETS.seal),
          prepareEmbossedSeal(GRADE_CARD_ASSETS.embossedSeal),
          prepareControllerSignature(sigUrl),
        ]);
        if (cancelled) return;
        setSealSrc(seal);
        setEmbossedSealSrc(embossed);
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
        className={`grade-card-page ${className}`}
        data-grade-card-page="front"
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#ffffff",
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
            top: GRADE_CARD_PAGE_BORDER.innerInset,
            left: GRADE_CARD_PAGE_BORDER.innerInset,
            width: A4_WIDTH - GRADE_CARD_PAGE_BORDER.innerInset * 2,
            height: A4_HEIGHT - GRADE_CARD_PAGE_BORDER.innerInset * 2,
            objectFit: "fill",
            pointerEvents: "none",
          }}
        />

        {/* Outer borders — matches drawOuterBorder */}
        <div
          style={{
            position: "absolute",
            top: GRADE_CARD_PAGE_BORDER.outerInset,
            left: GRADE_CARD_PAGE_BORDER.outerInset,
            right: GRADE_CARD_PAGE_BORDER.outerInset,
            bottom: GRADE_CARD_PAGE_BORDER.outerInset,
            border: `1.2px solid ${GRADE_CARD_COLORS.border}`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: GRADE_CARD_PAGE_BORDER.innerInset,
            left: GRADE_CARD_PAGE_BORDER.innerInset,
            right: GRADE_CARD_PAGE_BORDER.innerInset,
            bottom: GRADE_CARD_PAGE_BORDER.innerInset,
            border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
            pointerEvents: "none",
          }}
        />

        {/* Header row: unique id + QR (left), logo (centre), photo (right) */}
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
            width: headerLayout.qr.size,
            height: headerLayout.qr.size,
          }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: GRADE_CARD_COLORS.paper,
                border: "1px solid #ccc",
              }}
            />
          )}
        </div>

        {/* University logo — gold on transparent, centered in header slot */}
        <img
          src={logoSrc ?? GRADE_CARD_ASSETS.logo}
          alt="Garden City University"
          style={{
            position: "absolute",
            left: headerLayout.logo.left,
            top: headerLayout.logo.top,
            width: headerLayout.logo.width,
            height: headerLayout.logo.height,
            objectFit: "contain",
            objectPosition: "center",
            zIndex: 2,
          }}
        />

        {/* Student photo — borderless, blends with certificate background */}
        <div
          style={{
            position: "absolute",
            left: headerLayout.photo.left,
            top: headerLayout.photo.top,
            width: headerLayout.photo.width,
            height: headerLayout.photo.height,
            overflow: "hidden",
            background: "transparent",
            zIndex: 3,
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

        {/* School name + details + grade card + table — vertical flow (avoids overlap on long titles) */}
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

          <StudentDetailsSection marksheet={marksheet} />

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
            GRADE CARD
          </div>

          <div style={{ width: "100%" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              fontSize: 8.2,
            }}
          >
            <colgroup>
              {TABLE_COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {[
                  "SL\nNo.",
                  "COURSE\nCODE",
                  "COURSE TITLE",
                  "COURSE\nCREDITS",
                  "CREDITS\nEARNED",
                  "GRADE\nOBTAINED",
                  "GRADE\nPOINTS",
                ].map((header, i) => (
                  <th
                    key={i}
                    style={{
                      border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
                      padding: "2px 3px",
                      fontWeight: "bold",
                      fontSize: 7.9,
                      textAlign: "center",
                      verticalAlign: "middle",
                      whiteSpace: "pre-line",
                      lineHeight: 1.1,
                      height: 24,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            {groupCoursesBySection(marksheet.courses).map((group, groupIdx) => {
              const isPractical = group.section.trim().toLowerCase().includes("practical");
              return (
                <tbody key={groupIdx}>
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
                        height: 15,
                        fontWeight: "bold",
                        fontSize: isPractical ? 9.5 : 13.5,
                        color: isPractical ? GRADE_CARD_COLORS.dark : GRADE_CARD_COLORS.red,
                        textAlign: isPractical ? "left" : "center",
                        paddingLeft: isPractical ? 4 : 0,
                        verticalAlign: "middle",
                      }}
                    >
                      {isPractical ? "Practical" : group.section}
                    </td>
                  </tr>
                  {group.courses.map((course) => (
                    <tr key={`${course.sl_no}-${course.course_code}`}>
                      <td style={cellStyle("center")}>{course.sl_no}</td>
                      <td style={cellStyle("center")}>{course.course_code}</td>
                      <td style={cellStyle("left")}>{course.course_title}</td>
                      <td style={cellStyle("center")}>{formatGradeCardNumber(course.course_credits)}</td>
                      <td style={cellStyle("center")}>{formatGradeCardNumber(course.credits_earned)}</td>
                      <td style={cellStyle("center")}>{course.grade_obtained}</td>
                      <td style={cellStyle("center")}>{formatGradeCardNumber(course.grade_points)}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tbody>
              <tr>
                <td style={cellStyle("center")} />
                <td style={cellStyle("center")} />
                <td
                  style={{
                    ...cellStyle("right"),
                    fontWeight: "bold",
                    fontSize: 11,
                    color: GRADE_CARD_COLORS.red,
                  }}
                >
                  TOTAL
                </td>
                <td style={{ ...cellStyle("center"), fontWeight: "bold", fontSize: 11 }}>
                  {formatGradeCardNumber(marksheet.total_credits)}
                </td>
                <td style={{ ...cellStyle("center"), fontWeight: "bold", fontSize: 11 }}>
                  {formatGradeCardNumber(marksheet.total_credits_earned)}
                </td>
                <td style={cellStyle("center")} />
                <td style={cellStyle("center")} />
              </tr>
            </tbody>
          </table>

          {/* Totals box */}
          <div
            style={{
              border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
              borderTop: "none",
              height: 48,
              display: "grid",
              gridTemplateRows: "1fr 1fr",
            }}
          >
            <div
              style={{
                borderBottom: `0.45px solid ${GRADE_CARD_COLORS.border}`,
                display: "flex",
                alignItems: "center",
                paddingLeft: 7,
                fontSize: 12.5,
                fontWeight: "bold",
              }}
            >
              <span style={{ color: GRADE_CARD_COLORS.red }}>TOTAL CREDIT POINTS = </span>
              <span>{formatGradeCardNumber(marksheet.total_credit_points)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1, paddingLeft: 7, fontSize: 12.5, fontWeight: "bold" }}>
                <span style={{ color: GRADE_CARD_COLORS.red }}>SEMESTER GRADE POINT AVERAGE = </span>
                <span>
                  {formatGradeCardNumber(marksheet.total_credit_points)} /{" "}
                  {formatGradeCardNumber(marksheet.total_credits)} ={" "}
                  {formatSgpa(marksheet.sgpa)}
                </span>
              </div>
              <div
                style={{
                  width: 116,
                  borderLeft: `0.45px solid ${GRADE_CARD_COLORS.border}`,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12.5,
                  fontWeight: "bold",
                  gap: 4,
                }}
              >
                <span style={{ color: GRADE_CARD_COLORS.red }}>GRADE :</span>
                <span>{marksheet.final_grade}</span>
              </div>
            </div>
          </div>

          {/* Date — directly below totals (PDF: yEnd + 18) */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11.5,
              fontWeight: "bold",
              paddingTop: 18,
            }}
          >
            Date : {formatGradeCardDate(marksheet.issue_date || new Date().toISOString())}
          </div>
          </div>
        </div>

        {/* Footer — seal, embossed seal, controller signature (PDF coordinates) */}
        {(sealSrc ?? GRADE_CARD_ASSETS.seal) && (
          <img
            src={sealSrc ?? GRADE_CARD_ASSETS.seal}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              left: FRONT_PAGE_FOOTER.seal.x,
              top: FRONT_PAGE_FOOTER.seal.y,
              width: FRONT_PAGE_FOOTER.seal.w,
              height: FRONT_PAGE_FOOTER.seal.h,
              transform: "rotate(-6deg)",
              transformOrigin: "center center",
            }}
          />
        )}
        {(embossedSealSrc ?? GRADE_CARD_ASSETS.embossedSeal) && (
          <img
            src={embossedSealSrc ?? GRADE_CARD_ASSETS.embossedSeal}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              left: FRONT_PAGE_FOOTER.embossedSeal.x,
              top: FRONT_PAGE_FOOTER.embossedSeal.y,
              width: FRONT_PAGE_FOOTER.embossedSeal.w,
              height: FRONT_PAGE_FOOTER.embossedSeal.h,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        )}
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

const DETAILS_ROW_GAP = 8;

function StudentDetailsSection({ marksheet }: { marksheet: StudentMarksheet }) {
  const rows = [
    {
      leftLabel: "PROGRAMME TITLE",
      leftValue: formatProgrammeTitleDisplay(marksheet.programme_title),
      rightLabel: "PROGRAMME CODE",
      rightValue: marksheet.programme_code,
      leftMaxLines: 2 as const,
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
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: DETAILS_ROW_GAP,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          flex: 1,
          minWidth: 0,
        }}
      >
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
      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          lineHeight: 1.15,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: "normal" }}>{rightLabel} : </span>
        <span style={{ fontWeight: "bold" }}>{rightValue}</span>
      </div>
    </div>
  );
}

function cellStyle(textAlign: "left" | "center" | "right") {
  return {
    border: `0.45px solid ${GRADE_CARD_COLORS.border}`,
    padding: "2px 4px",
    textAlign,
    verticalAlign: "middle" as const,
    lineHeight: 1.15,
  };
}

export type GradeCardBackPageTemplateProps = {
  checkedByUrl?: string | null;
  verifiedByUrl?: string | null;
  className?: string;
};

type BackPageSignatureSlot = (typeof BACK_PAGE_LAYOUT)["slots"]["checkedBy"];

function BackPageSlotWipe({
  slot,
  paperColor,
}: {
  slot: BackPageSignatureSlot;
  paperColor: string;
}) {
  const wipeTop = slot.signatureTop - 2;
  const wipeLeft = slot.centerX - slot.wipe.w / 2;
  const wipeHeight = getBackPageWipeHeight(slot);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: wipeLeft,
        top: wipeTop,
        width: slot.wipe.w,
        height: wipeHeight,
        backgroundColor: paperColor,
      }}
    />
  );
}

function BackPageSignatureOverlay({
  slot,
  src,
  label,
}: {
  slot: BackPageSignatureSlot;
  src: string;
  label: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: slot.centerX,
        top: slot.signatureTop,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: slot.image.w,
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        style={{
          width: slot.image.w,
          height: slot.image.h,
          objectFit: "contain",
          objectPosition: "bottom center",
          display: "block",
        }}
      />
      <span
        style={{
          marginTop: slot.label.gapAbove,
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: slot.label.fontSize,
          fontWeight: "normal",
          lineHeight: 1,
          color: GRADE_CARD_COLORS.dark,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}


export const GradeCardBackPageTemplate = forwardRef<HTMLDivElement, GradeCardBackPageTemplateProps>(
  function GradeCardBackPageTemplate({ checkedByUrl, verifiedByUrl, className = "" }, ref) {
    const { slots, paperColor } = BACK_PAGE_LAYOUT;
    const [checkedBySrc, setCheckedBySrc] = useState<string | null>(null);
    const [verifiedBySrc, setVerifiedBySrc] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const [checked, verified] = await Promise.all([
          checkedByUrl ? loadTransparentAsset(checkedByUrl) : Promise.resolve(null),
          verifiedByUrl ? loadTransparentAsset(verifiedByUrl) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCheckedBySrc(checked);
        setVerifiedBySrc(verified);
      })();
      return () => {
        cancelled = true;
      };
    }, [checkedByUrl, verifiedByUrl]);

    return (
      <div
        ref={ref}
        className={`grade-card-page ${className}`}
        data-grade-card-page="back"
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#fdfcf7",
        }}
      >
        <img
          src={GRADE_CARD_ASSETS.backPage}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT,
            display: "block",
          }}
        />
        <BackPageSlotWipe slot={slots.checkedBy} paperColor={paperColor} />
        <BackPageSlotWipe slot={slots.verifiedBy} paperColor={paperColor} />
        {checkedBySrc && (
          <BackPageSignatureOverlay
            slot={slots.checkedBy}
            src={checkedBySrc}
            label="Checked by"
          />
        )}
        {verifiedBySrc && (
          <BackPageSignatureOverlay
            slot={slots.verifiedBy}
            src={verifiedBySrc}
            label="Verified by"
          />
        )}
      </div>
    );
  },
);
