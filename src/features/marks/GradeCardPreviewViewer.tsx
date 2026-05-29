import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  GradeCardDocument,
  type GradeCardDocumentHandle,
} from "@/features/marks/GradeCardDocument";
import {
  GradeCardESignaturePanel,
  useGradeCardSignatureApproved,
} from "@/features/marks/GradeCardESignaturePanel";
import { buildGradeCardFrontPages, getSemesterNumber } from "@/lib/grade-card-filter";
import { generateGradeCardPdfFromDocument } from "@/lib/grade-card-pdf";
import { downloadMarksheetBlob } from "@/lib/marksheet-documents";
import type { StudentMarksheet } from "@/lib/marksheet";
import { A4_HEIGHT, A4_WIDTH } from "@/lib/grade-card-constants";

type ZoomMode = 0.5 | 0.75 | 1 | "fit";

type Props = {
  studentId: string;
  activeSheet: StudentMarksheet | null;
  allSheets: StudentMarksheet[];
  photoUrl?: string | null;
  showAllSemesters?: boolean;
  loading?: boolean;
  darkTheme?: boolean;
  onSelectSemester?: (sheet: StudentMarksheet) => void;
  onShowAllSemesters?: () => void;
  emptyMessage?: string;
  /** When false, hides the Download PDF control (e.g. Admin preview-only). */
  showDownloadButton?: boolean;
};

export function GradeCardPreviewViewer({
  studentId,
  activeSheet,
  allSheets,
  photoUrl,
  showAllSemesters = false,
  loading = false,
  darkTheme = true,
  onSelectSemester,
  onShowAllSemesters,
  emptyMessage = "No grade card data yet. Upload the Excel marks sheet (and optional photo ZIP) from the COE home page.",
  showDownloadButton = false,
}: Props) {
  const documentRef = useRef<GradeCardDocumentHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState<ZoomMode>(0.75);
  const [fitScale, setFitScale] = useState(0.75);
  const [downloading, setDownloading] = useState(false);

  const { approved, previewUrls, refresh: refreshSignatures } = useGradeCardSignatureApproved(studentId);

  const frontPages = buildGradeCardFrontPages(activeSheet, allSheets, showAllSemesters);
  const totalPages = frontPages.length + 1;

  useEffect(() => {
    setPageIndex(0);
  }, [activeSheet?.semester_label, showAllSemesters, frontPages.length]);

  useEffect(() => {
    function updateFitScale() {
      if (!viewportRef.current) return;
      const available = viewportRef.current.clientWidth - 32;
      setFitScale(Math.min(1, available / A4_WIDTH));
    }
    updateFitScale();
    window.addEventListener("resize", updateFitScale);
    return () => window.removeEventListener("resize", updateFitScale);
  }, []);

  const effectiveScale = zoom === "fit" ? fitScale : zoom;

  async function downloadPdf() {
    if (!activeSheet || frontPages.length === 0) return;
    if (!approved) {
      toast.error("Approve e-signatures before generating the final grade card PDF.");
      return;
    }
    setDownloading(true);
    try {
      const pages = documentRef.current?.getPageElements() ?? [];
      const blob = await generateGradeCardPdfFromDocument(pages);
      const labelSheet = frontPages[0] ?? activeSheet;
      downloadMarksheetBlob(labelSheet, "pdf", blob);
      toast.success("Final grade card PDF downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate grade card PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const pageLabel =
    pageIndex < frontPages.length
      ? frontPages[pageIndex]?.semester_label ?? `Page ${pageIndex + 1}`
      : "Back Page";

  return (
    <div className="space-y-4">
      <GradeCardESignaturePanel
        studentId={studentId}
        darkTheme={darkTheme}
        onApprovalChange={() => {
          void refreshSignatures();
        }}
      />

      {allSheets.length > 1 && onSelectSemester && onShowAllSemesters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Semester:</span>
          {allSheets.map((sheet) => {
            const semName = (sheet.semester_label || "").toLowerCase().startsWith("sem")
              ? sheet.semester_label
              : `Sem ${sheet.semester_label}`;
            const isSelected = !showAllSemesters && activeSheet?.semester_label === sheet.semester_label;
            return (
              <button
                key={sheet.semester_label}
                type="button"
                onClick={() => onSelectSemester(sheet)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition border ${
                  isSelected
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                }`}
              >
                {semName}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onShowAllSemesters}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition border ${
              showAllSemesters
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
            }`}
          >
            All Sem
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Zoom:</span>
          {([0.5, 0.75, 1, "fit"] as const).map((level) => (
            <button
              key={String(level)}
              type="button"
              onClick={() => setZoom(level)}
              className={`rounded px-2.5 py-1 text-xs font-bold border transition ${
                zoom === level
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {level === "fit" ? "Fit Width" : `${level * 100}%`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-xs font-medium text-slate-300">
            {totalPages > 0 ? `${pageIndex + 1} / ${totalPages}` : "—"} · {pageLabel}
          </span>
          <button
            type="button"
            disabled={pageIndex >= totalPages - 1}
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {showDownloadButton && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!approved || frontPages.length === 0}
              onClick={() => void downloadPdf()}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                approved
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
              title={!approved ? "Approve e-signatures first" : "Download PDF"}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading grade card preview…</p>
        </div>
      ) : frontPages.length > 0 ? (
        <div
          ref={viewportRef}
          className="overflow-x-auto overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-4"
          style={{ maxHeight: "70vh" }}
        >
          <div
            className="mx-auto"
            style={{
              width: A4_WIDTH * effectiveScale,
              height: A4_HEIGHT * effectiveScale,
            }}
          >
            <div
              className="origin-top-left"
              style={{
                width: A4_WIDTH,
                height: A4_HEIGHT,
                transform: `scale(${effectiveScale})`,
              }}
            >
              <GradeCardDocument
                ref={documentRef}
                frontPages={frontPages}
                photoUrl={photoUrl}
                backPageSignatures={previewUrls}
                visiblePageIndex={pageIndex}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">{emptyMessage}</p>
      )}

      {!showDownloadButton && !approved && frontPages.length > 0 && (
        <p className="text-center text-xs text-amber-400/90">
          Approve e-signatures above before students can receive the final grade card.
        </p>
      )}

      {showDownloadButton && !approved && frontPages.length > 0 && (
        <p className="text-center text-xs text-amber-400/90">
          Draw and approve e-signatures above, then download the final PDF.
        </p>
      )}
    </div>
  );
}

export { getSemesterNumber };
