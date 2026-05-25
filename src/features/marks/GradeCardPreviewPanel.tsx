import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { HighFidelityGradeCard } from "@/features/marks/HighFidelityGradeCard";
import {
  GradeCardESignaturePanel,
  useGradeCardSignatureApproved,
} from "@/features/marks/GradeCardESignaturePanel";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import {
  calculateMarksheetTotals,
  fetchAllStudentMarksheets,
  resolveStudentPhotoUrl,
  type StudentMarksheet,
} from "@/lib/marksheet";
import { downloadMarksheetBlob, generateMarksheetPdf } from "@/lib/marksheet-documents";

function getSemesterNumber(label: string): number {
  const clean = (label || "").toUpperCase().trim();
  if (clean.includes("VIII") || clean.includes("8")) return 8;
  if (clean.includes("VII") || clean.includes("7")) return 7;
  if (clean.includes("VI") || clean.includes("6")) return 6;
  if (clean.includes("IV") || clean.includes("4")) return 4;
  if (clean.includes("III") || clean.includes("3")) return 3;
  if (clean.includes("II") || clean.includes("2")) return 2;
  if (clean.includes("I") || clean.includes("1")) return 1;
  if (clean.includes("V") || clean.includes("5")) return 5;
  return 1;
}

function getFilteredMarksheet(
  currentSheet: StudentMarksheet | null,
  allSheets: StudentMarksheet[],
  showAll: boolean,
): StudentMarksheet | null {
  if (!currentSheet) return null;
  if (showAll) {
    const sorted = [...allSheets].sort(
      (a, b) => getSemesterNumber(b.semester_label) - getSemesterNumber(a.semester_label),
    );
    const latest = sorted[0] || currentSheet;
    const reindexedCourses = (latest.courses || []).map((c, i) => ({ ...c, sl_no: i + 1 }));
    const totals = calculateMarksheetTotals(reindexedCourses);
    return {
      ...latest,
      courses: reindexedCourses,
      total_credits: totals.totalCredits,
      total_credits_earned: totals.totalCreditsEarned,
      total_credit_points: totals.totalCreditPoints,
      sgpa: totals.sgpa,
      final_grade: totals.finalGrade,
    };
  }

  const currentSemNum = getSemesterNumber(currentSheet.semester_label);
  const previousCourseCodes = new Set<string>();

  for (const sheet of allSheets) {
    if (getSemesterNumber(sheet.semester_label) < currentSemNum) {
      for (const c of sheet.courses || []) {
        const code = String(c.course_code || "").toUpperCase().trim();
        if (code) previousCourseCodes.add(code);
      }
    }
  }

  const filteredCourses = (currentSheet.courses || []).filter((c) => {
    const code = String(c.course_code || "").toUpperCase().trim();
    return !previousCourseCodes.has(code);
  });

  const reindexedCourses = filteredCourses.map((c, i) => ({ ...c, sl_no: i + 1 }));
  const totals = calculateMarksheetTotals(reindexedCourses);

  return {
    ...currentSheet,
    courses: reindexedCourses,
    total_credits: totals.totalCredits,
    total_credits_earned: totals.totalCreditsEarned,
    total_credit_points: totals.totalCreditPoints,
    sgpa: totals.sgpa,
    final_grade: totals.finalGrade,
  };
}

type Props = {
  studentId: string;
  semester?: number;
  /** Re-load preview when marks are saved from the editor below. */
  refreshKey?: number;
};

export function GradeCardPreviewPanel({ studentId, semester = 1, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [allSheets, setAllSheets] = useState<StudentMarksheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<StudentMarksheet | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showAllSemesters, setShowAllSemesters] = useState(false);
  const { approved, refresh: refreshSignatures } = useGradeCardSignatureApproved(studentId);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const sheets = await fetchAllStudentMarksheets(supabase, studentId);
      setAllSheets(sheets);

      const romanNumerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      const activeRoman = romanNumerals[semester] || "";

      let initialSheet = sheets.find((s) => {
        const label = (s.semester_label || "").toUpperCase();
        const numPattern = new RegExp(`\\b${semester}\\b`);
        const romanPattern = activeRoman ? new RegExp(`\\b${activeRoman}\\b`) : null;
        return numPattern.test(label) || (romanPattern && romanPattern.test(label));
      });

      if (!initialSheet && sheets.length > 0) {
        initialSheet = sheets[0];
      }

      setActiveSheet(initialSheet || null);

      if (initialSheet) {
        const url = await resolveStudentPhotoUrl(supabase, initialSheet, { studentUuid: studentId });
        setPhotoUrl(url);
      } else {
        setPhotoUrl(null);
      }
    } catch {
      toast.error("Could not load grade card preview.");
      setAllSheets([]);
      setActiveSheet(null);
      setPhotoUrl(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, semester]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, refreshKey]);

  async function selectSemester(sheet: StudentMarksheet) {
    setActiveSheet(sheet);
    setShowAllSemesters(false);
    try {
      const url = await resolveStudentPhotoUrl(supabase, sheet, { studentUuid: studentId });
      setPhotoUrl(url);
    } catch (e) {
      console.error(e);
    }
  }

  async function downloadPdf() {
    if (!activeSheet) return;
    if (!approved) {
      toast.error("Approve e-signatures before generating the final grade card PDF.");
      return;
    }
    setDownloading(true);
    try {
      const [resolvedPhoto, backSigs] = await Promise.all([
        resolveStudentPhotoUrl(supabase, activeSheet, { studentUuid: studentId }),
        fetchApprovedBackPageSignatures(supabase, studentId),
      ]);
      const filtered = getFilteredMarksheet(activeSheet, allSheets, showAllSemesters);
      if (!filtered) return;
      const blob = await generateMarksheetPdf(filtered, {
        photoUrl: resolvedPhoto,
        allMarksheets: allSheets,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadMarksheetBlob(filtered, "pdf", blob);
      toast.success("Final grade card PDF downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate grade card PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const displaySheet = getFilteredMarksheet(activeSheet, allSheets, showAllSemesters);

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-slate-950/95 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Grade card preview</h3>
          <p className="text-xs text-slate-400">
            Student marks from Excel with photo matched by registration number.
          </p>
        </div>
        <button
          type="button"
          disabled={!displaySheet || downloading || !approved}
          onClick={() => void downloadPdf()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          title={!approved ? "Approve e-signatures first" : undefined}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Generate Final PDF
        </button>
      </div>

      <GradeCardESignaturePanel
        studentId={studentId}
        darkTheme
        onApprovalChange={() => void refreshSignatures()}
      />

      {allSheets.length > 1 && (
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
                onClick={() => void selectSemester(sheet)}
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
            onClick={() => setShowAllSemesters(true)}
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

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading grade card preview…</p>
        </div>
      ) : displaySheet ? (
        <div className="overflow-x-auto flex justify-center rounded-lg border border-slate-800 bg-slate-950 p-2">
          {showAllSemesters ? (
            <div className="flex flex-col gap-10 w-full items-center py-4">
              {[...allSheets]
                .sort((a, b) => getSemesterNumber(a.semester_label) - getSemesterNumber(b.semester_label))
                .map((sheet) => {
                  const filtered = getFilteredMarksheet(sheet, allSheets, false);
                  if (!filtered) return null;
                  return (
                    <div key={sheet.id || sheet.semester_label} className="flex flex-col items-center w-full">
                      <div className="mb-3 rounded-full border border-slate-700/50 bg-slate-800/80 px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                        {sheet.semester_label}
                      </div>
                      <div className="origin-top scale-[0.75] md:scale-[0.85] lg:scale-100">
                        <HighFidelityGradeCard marksheet={filtered} photoUrl={photoUrl} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="origin-top scale-[0.75] md:scale-[0.85] lg:scale-100 py-2">
              <HighFidelityGradeCard marksheet={displaySheet} photoUrl={photoUrl} />
            </div>
          )}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">
          No grade card data yet. Upload the Excel marks sheet (and optional photo ZIP) from the COE home page.
        </p>
      )}
    </div>
  );
}
