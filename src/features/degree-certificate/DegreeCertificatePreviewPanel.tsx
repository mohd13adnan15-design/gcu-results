import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DegreeCertificateDocument } from "@/features/degree-certificate/DegreeCertificateDocument";
import { supabase } from "@/integrations/supabase/client";
import { buildDegreeCertificateView } from "@/lib/degree-certificate/data";
import type { DegreeCertificateView } from "@/lib/degree-certificate/types";

type Props = {
  studentId: string;
};

export function DegreeCertificatePreviewPanel({ studentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DegreeCertificateView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const view = await buildDegreeCertificateView(supabase, studentId, {
        previewMode: true,
      });
      setData(view);
    } catch {
      toast.error("Could not load degree certificate data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-cream p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading degree certificate…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        No COE marksheet data found for this student. Upload semester records before previewing the
        degree certificate.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-cream p-4">
      <div>
        <h3 className="text-base font-bold text-primary">{data.studentName}</h3>
        <p className="text-sm text-muted-foreground">
          {data.registrationNo} · {data.degreeName} · CGPA {data.gradeLabel} (
          {data.semesterRecords.length} semesters)
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-6">
        <DegreeCertificateDocument data={data} showPageLabels />
      </div>
    </div>
  );
}
