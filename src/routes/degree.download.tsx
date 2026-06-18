import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DegreeCertificateDocument } from "@/features/degree-certificate/DegreeCertificateDocument";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDegreeCertificateView,
  fetchStudentByRegistration,
} from "@/lib/degree-certificate/data";
import { generateDegreeCertificatePdfFromPreview } from "@/lib/degree-certificate/degree-certificate-pdf";
import type { DegreeCertificateView } from "@/lib/degree-certificate/types";
import { downloadBlob } from "@/lib/marksheet-documents";

export function DegreeQrDownloadPage() {
  const [params] = useSearchParams();
  const registrationNo = useMemo(() => params.get("reg")?.trim() ?? "", [params]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DegreeCertificateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!registrationNo) {
        setLoading(false);
        return;
      }
      try {
        const student = await fetchStudentByRegistration(supabase, registrationNo);
        if (!active) return;
        if (!student) {
          setData(null);
          return;
        }

        const issuedView = await buildDegreeCertificateView(supabase, student.id);
        if (!active) return;

        if (issuedView?.certificateNumber) {
          setData(issuedView);
          return;
        }

        const previewView = await buildDegreeCertificateView(supabase, student.id, {
          previewMode: true,
        });
        if (active) setData(previewView);
      } catch (error) {
        if (active) {
          setData(null);
          toast.error(error instanceof Error ? error.message : "Could not load degree certificate");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [registrationNo]);

  async function handleDownload() {
    if (!previewRef.current || !data) return;
    setDownloadBusy(true);
    try {
      const blob = await generateDegreeCertificatePdfFromPreview(previewRef.current);
      const safeName = data.studentName.replace(/[^\w.-]+/g, "_");
      downloadBlob(blob, `DegreeCertificate_${safeName}_${data.registrationNo}.pdf`);
      toast.success("Degree certificate PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate degree certificate PDF");
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-5xl rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-xl font-bold text-primary">Degree Certificate Download</h1>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        ) : !registrationNo || !data ? (
          <p className="mt-3 text-sm text-rose-700">
            This QR code is invalid or the degree certificate was not found.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                Student: <strong className="text-primary">{data.studentName}</strong>
              </p>
              <p className="mt-1">
                Registration No: <strong className="text-primary">{data.registrationNo}</strong>
              </p>
              <p className="mt-1">
                Degree: <strong className="text-primary">{data.degreeName}</strong>
              </p>
              {data.certificateNumber ? (
                <p className="mt-1">
                  Certificate No: <strong className="text-primary">{data.certificateNumber}</strong>
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h2 className="font-bold text-primary">Download Degree Certificate</h2>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloadBusy}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {downloadBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {downloadBusy ? "Generating..." : "Download Degree Certificate"}
              </button>
            </div>

            <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-4">
              <DegreeCertificateDocument ref={previewRef} data={data} />
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
