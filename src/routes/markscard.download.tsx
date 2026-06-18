import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
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

export function MarkscardQrDownloadPage() {
  const [params] = useSearchParams();
  const registrationNo = useMemo(() => params.get("reg")?.trim() ?? "", [params]);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [allMarksheets, setAllMarksheets] = useState<StudentMarksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!registrationNo) {
        setLoading(false);
        return;
      }
      try {
        const row = await fetchMarksheetByRegistrationNo(supabase, registrationNo);
        if (!active) return;
        if (!row) {
          setMarksheet(null);
          setAllMarksheets([]);
          return;
        }

        setMarksheet(row);
        const sheets = await fetchAllStudentMarksheets(supabase, row.student_id);
        if (!active) return;

        const scoped = (sheets.length > 0 ? sheets : [row]).filter(
          (sheet) => sheet.student_id === row.student_id,
        );
        setAllMarksheets(scoped);
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Could not load marks card");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [registrationNo]);

  async function downloadMarksCard(targetMarksheet: StudentMarksheet) {
    if (!targetMarksheet.courses?.length) {
      toast.error("No marks card data for this semester.");
      return;
    }

    setDownloadBusy(targetMarksheet.id ?? targetMarksheet.semester_label ?? "current");
    try {
      const [documents, photoUrl] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, targetMarksheet),
      ]);
      const blob = await documents.generateMarksCardPdf(targetMarksheet, {
        photoUrl,
        allMarksheets,
      });
      documents.downloadMarksCardBlob(targetMarksheet, blob);
      toast.success("Marks card PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate marks card PDF");
    } finally {
      setDownloadBusy(null);
    }
  }

  const availableMarksheets = allMarksheets.filter((sheet) => sheet.courses?.length);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-xl font-bold text-primary">Marks Card Download</h1>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        ) : !registrationNo || !marksheet ? (
          <p className="mt-3 text-sm text-rose-700">
            This QR code is invalid or the marks card was not found.
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
              <h2 className="font-bold text-primary">Download Marks Cards</h2>
              {availableMarksheets.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No marks card records are available for this student yet.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-3">
                  {availableMarksheets.map((sheet) => {
                    const busyKey = sheet.id ?? sheet.semester_label ?? "current";
                    return (
                      <button
                        key={busyKey}
                        type="button"
                        onClick={() => void downloadMarksCard(sheet)}
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
