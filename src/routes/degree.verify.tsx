import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { buildDegreeCertificateView } from "@/lib/degree-certificate/data";

export function DegreeVerifyPage() {
  const [params] = useSearchParams();
  const cert = params.get("cert")?.trim() ?? "";
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [summary, setSummary] = useState<{
    studentName: string;
    registrationNo: string;
    degreeName: string;
    cgpa: string;
    generatedAt: string;
  } | null>(null);

  useEffect(() => {
    if (!cert) {
      setLoading(false);
      setValid(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const { data: row, error } = await supabase
          .from("degree_certificates")
          .select("student_id, certificate_number, generated_at")
          .eq("certificate_number", cert)
          .maybeSingle();
        if (error && error.code !== "42P01") throw error;
        if (!row) {
          setValid(false);
          setSummary(null);
          return;
        }
        const view = await buildDegreeCertificateView(supabase, row.student_id, {
          certificateNumber: row.certificate_number,
        });
        if (!view) {
          setValid(false);
          setSummary(null);
          return;
        }
        setValid(true);
        setSummary({
          studentName: view.studentName,
          registrationNo: view.registrationNo,
          degreeName: view.degreeName,
          cgpa: view.gradeLabel,
          generatedAt: new Date(row.generated_at).toLocaleString("en-IN"),
        });
      } catch {
        setValid(false);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [cert]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-border bg-cream p-6 shadow-sm">
        <h1 className="text-xl font-bold text-primary">Degree Certificate Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Garden City University</p>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </div>
        ) : !cert ? (
          <p className="mt-6 text-sm text-muted-foreground">No certificate number provided.</p>
        ) : valid && summary ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Valid certificate</span>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Certificate number</dt>
                <dd className="font-medium">{cert}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Student</dt>
                <dd className="font-medium">{summary.studentName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registration</dt>
                <dd className="font-medium">{summary.registrationNo}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Degree</dt>
                <dd className="font-medium">{summary.degreeName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">CGPA</dt>
                <dd className="font-medium">{summary.cgpa}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Issued</dt>
                <dd className="font-medium">{summary.generatedAt}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            <span className="text-sm">Certificate number not found in the registry.</span>
          </div>
        )}

        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          ← Home
        </Link>
      </div>
    </main>
  );
}
