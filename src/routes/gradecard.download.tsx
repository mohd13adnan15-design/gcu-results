import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import {
  fetchAllStudentMarksheets,
  fetchMarksheetByRegistrationNo,
  resolveStudentPhotoUrl,
  type StudentMarksheet,
} from "@/lib/marksheet";

function formatSemesterLabel(marksheet: StudentMarksheet): string {
  const label = marksheet.semester_label || "";
  return label.toLowerCase().startsWith("sem") ? label : `Sem ${label}`;
}

export function GradecardQrDownloadPage() {
  const [params] = useSearchParams();
  const registrationNo = useMemo(() => params.get("reg")?.trim() ?? "", [params]);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [allMarksheets, setAllMarksheets] = useState<StudentMarksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [showSemesterSelection, setShowSemesterSelection] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!registrationNo) {
        setLoading(false);
        return;
      }
      try {
        const row = await fetchMarksheetByRegistrationNo(supabase, registrationNo);
        if (!active || !row) return;

        setMarksheet(row);
        const sheets = await fetchAllStudentMarksheets(supabase, row.student_id);
        if (active) {
          setAllMarksheets(sheets.length > 0 ? sheets : [row]);
        }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load grade card");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [registrationNo]);

  async function downloadMarksheet(targetMarksheet: StudentMarksheet) {
    setDownloadBusy(targetMarksheet.id ?? targetMarksheet.semester_label ?? "current");
    try {
      const [{ generateMarksheetPdf, downloadMarksheetBlob }, photoUrl, backSigs] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, targetMarksheet),
        fetchApprovedBackPageSignatures(supabase, targetMarksheet.student_id),
      ]);
      const blob = await generateMarksheetPdf(targetMarksheet, {
        photoUrl,
        allMarksheets,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadMarksheetBlob(targetMarksheet, "pdf", blob);
      toast.success("Grade card PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate grade card PDF");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadAllSemesters() {
    if (allMarksheets.length === 0) {
      toast.error("No grade card data found.");
      return;
    }

    setDownloadBusy("all");
    try {
      const primary = marksheet ?? allMarksheets[0];
      const [{ downloadBlob, generateAllSemestersPdf }, photoUrl, backSigs] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, primary),
        fetchApprovedBackPageSignatures(supabase, primary.student_id),
      ]);
      const blob = await generateAllSemestersPdf(allMarksheets, {
        photoUrl,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadBlob(blob, "GradeCard_AllSemesters.pdf");
      toast.success("All semesters PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate all semesters PDF");
    } finally {
      setDownloadBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-xl font-bold text-primary">Grade Card Download</h1>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        ) : !registrationNo || !marksheet ? (
          <p className="mt-3 text-sm text-rose-700">
            This QR code is invalid or the grade card was not found.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                Student: <strong className="text-primary">{marksheet.student_name}</strong>
              </p>
              <p className="mt-1">
                Registration No: <strong className="text-primary">{marksheet.registration_no}</strong>
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h2 className="font-bold text-primary">Download Grade Cards</h2>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSemesterSelection((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    <FileText className="h-4 w-4" />
                    Download semester wise
                  </button>
                  {allMarksheets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void downloadAllSemesters()}
                      disabled={Boolean(downloadBusy)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 text-sm font-medium text-primary hover:bg-muted disabled:opacity-60"
                    >
                      <FileDown className="h-4 w-4" />
                      {downloadBusy === "all" ? "Generating..." : "Download All Semesters"}
                    </button>
                  )}
                </div>

                {showSemesterSelection && allMarksheets.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-1 w-full text-sm font-medium text-primary">Select Semester:</p>
                    {allMarksheets.map((sheet) => {
                      const busyKey = sheet.id ?? sheet.semester_label ?? "current";
                      return (
                        <button
                          key={busyKey}
                          type="button"
                          onClick={() => void downloadMarksheet(sheet)}
                          disabled={Boolean(downloadBusy)}
                          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                        >
                          <FileText className="h-4 w-4" />
                          {downloadBusy === busyKey ? "Generating..." : formatSemesterLabel(sheet)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="mt-6">
          <Link to="/" className="text-sm text-primary hover:underline">
            Return to portal
          </Link>
        </div>
      </section>
    </main>
  );
}
