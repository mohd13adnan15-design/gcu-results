import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { DegreeCertificateDocument } from "@/features/degree-certificate/DegreeCertificateDocument";
import { getStudentSession } from "@/lib/auth";
import { buildDegreeCertificateView } from "@/lib/degree-certificate/data";
import { generateDegreeCertificatePdfFromPreview } from "@/lib/degree-certificate/degree-certificate-pdf";
import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/marksheet-documents";
import type { DegreeCertificateView } from "@/lib/degree-certificate/types";

export function StudentDegreeCertificatePage() {
  return (
    <StudentLayout title="Degree Certificate">
      {() => <StudentDegreeCertificateContent />}
    </StudentLayout>
  );
}

function StudentDegreeCertificateContent() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<DegreeCertificateView | null>(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) return;
    void (async () => {
      setLoading(true);
      try {
        const view = await buildDegreeCertificateView(supabase, session.id);
        setData(view);
      } catch {
        toast.error("Could not load degree certificate.");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDownload() {
    if (!pageRef.current || !data?.certificateNumber) return;
    setDownloading(true);
    try {
      const blob = await generateDegreeCertificatePdfFromPreview(pageRef.current);
      downloadBlob(blob, `DegreeCertificate_${data.registrationNo}.pdf`);
      toast.success("Degree certificate downloaded.");
    } catch {
      toast.error("Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Degree certificate data is not available yet. Contact the COE office after your final
        semester records are uploaded.
      </p>
    );
  }

  if (!data.certificateNumber) {
    return (
      <p className="text-sm text-muted-foreground">
        Your degree certificate has not been issued yet. The COE will generate your certificate
        number when your degree is ready.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        CGPA {data.gradeLabel} · Certificate {data.certificateNumber}
      </p>
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download degree certificate
      </button>
      <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-4">
        <DegreeCertificateDocument ref={pageRef} data={data} />
      </div>
    </div>
  );
}
