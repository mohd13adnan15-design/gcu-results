import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import {
  fetchMarksheetByRegistrationNo,
  resolveStudentPhotoUrl,
  normalizeMarksheet,
  type StudentMarksheet,
} from "@/lib/marksheet";

export function GradecardQrDownloadPage() {
  const [params] = useSearchParams();
  const registrationNo = useMemo(() => params.get("reg")?.trim() ?? "", [params]);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [allMarksheets, setAllMarksheets] = useState<StudentMarksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!registrationNo) {
        setLoading(false);
        return;
      }
      try {
        const row = await fetchMarksheetByRegistrationNo(supabase, registrationNo);
        if (active && row) {
          setMarksheet(row);
          // Fetch all marksheets for this student to allow proper semester course filtering
          const { data: allRows } = await supabase
            .from("student_marksheets")
            .select("*")
            .eq("student_id", row.student_id)
            .order("semester_label", { ascending: true });
          if (active && allRows) {
            setAllMarksheets(allRows.map(normalizeMarksheet));
          }
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

  async function downloadGradeCard() {
    if (!marksheet) return;
    setDownloading(true);
    try {
      const [{ generateMarksheetPdf, downloadMarksheetBlob }, photoUrl, backSigs] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, marksheet),
        fetchApprovedBackPageSignatures(supabase, marksheet.student_id),
      ]);
      const blob = await generateMarksheetPdf(marksheet, {
        photoUrl,
        allMarksheets,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadMarksheetBlob(marksheet, "pdf", blob);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate grade card PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-primary">Grade Card Download</h1>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        ) : !registrationNo || !marksheet ? (
          <p className="mt-3 text-sm text-rose-700">
            This QR code is invalid or the grade card was not found.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Registration No: <strong>{marksheet.registration_no}</strong>
            </p>
            <button
              type="button"
              onClick={() => void downloadGradeCard()}
              disabled={downloading}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <FileDown className="h-4 w-4" />
              {downloading ? "Generating PDF..." : "Download Grade Card PDF"}
            </button>
          </>
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
