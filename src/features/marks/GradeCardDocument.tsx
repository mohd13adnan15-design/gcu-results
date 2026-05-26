import { forwardRef, useImperativeHandle, useRef } from "react";

import type { BackPageSignatureOptions } from "@/lib/marksheet-documents";
import type { StudentMarksheet } from "@/lib/marksheet";
import {
  GradeCardBackPageTemplate,
  GradeCardTemplate,
} from "@/features/marks/GradeCardTemplate";

export type GradeCardDocumentHandle = {
  getPageElements: () => HTMLElement[];
};

export type GradeCardDocumentProps = {
  frontPages: StudentMarksheet[];
  photoUrl?: string | null;
  backPageSignatures?: BackPageSignatureOptions;
  /** When true, pages are stacked for off-screen PDF capture. When false, only one page is visible at a time via parent. */
  captureMode?: boolean;
  visiblePageIndex?: number;
};

export const GradeCardDocument = forwardRef<GradeCardDocumentHandle, GradeCardDocumentProps>(
  function GradeCardDocument(
    {
      frontPages,
      photoUrl,
      backPageSignatures,
      captureMode = false,
      visiblePageIndex = 0,
    },
    ref,
  ) {
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

    useImperativeHandle(ref, () => ({
      getPageElements: () =>
        pageRefs.current.filter((el): el is HTMLDivElement => el !== null),
    }));

    const totalPages = frontPages.length + 1;
    let refIndex = 0;

    return (
      <div className="grade-card-document" data-total-pages={totalPages}>
        {frontPages.map((marksheet, index) => {
          const currentRefIndex = refIndex++;
          const isVisible = captureMode || visiblePageIndex === index;
          return (
            <div
              key={marksheet.id ?? `${marksheet.semester_label}-${index}`}
              style={{
                display: isVisible ? "block" : "none",
              }}
            >
              <GradeCardTemplate
                ref={(el) => {
                  pageRefs.current[currentRefIndex] = el;
                }}
                marksheet={marksheet}
                photoUrl={photoUrl}
              />
            </div>
          );
        })}
        {(() => {
          const backIndex = refIndex;
          const isVisible = captureMode || visiblePageIndex === frontPages.length;
          return (
            <div style={{ display: isVisible ? "block" : "none" }}>
              <GradeCardBackPageTemplate
                ref={(el) => {
                  pageRefs.current[backIndex] = el;
                }}
                checkedByUrl={backPageSignatures?.checkedByUrl}
                verifiedByUrl={backPageSignatures?.verifiedByUrl}
              />
            </div>
          );
        })()}
      </div>
    );
  },
);
