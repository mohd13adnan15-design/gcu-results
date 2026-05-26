import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { GradeCardPreviewViewer } from "@/features/marks/GradeCardPreviewViewer";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllStudentMarksheets, resolveStudentPhotoUrl, type StudentMarksheet } from "@/lib/marksheet";

type Props = {
  studentId: string;
  semester?: number;
  /** Re-load preview when marks are saved from the editor below. */
  refreshKey?: number;
};

export function GradeCardPreviewPanel({ studentId, semester = 1, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [allSheets, setAllSheets] = useState<StudentMarksheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<StudentMarksheet | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showAllSemesters, setShowAllSemesters] = useState(false);

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

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-slate-950/95 p-4">
      <div>
        <h3 className="text-sm font-bold text-white">Grade card preview</h3>
        <p className="text-xs text-slate-400">
          Preview matches the final PDF exactly — same layout, data, photos, and signatures.
        </p>
      </div>

      <GradeCardPreviewViewer
        studentId={studentId}
        activeSheet={activeSheet}
        allSheets={allSheets}
        photoUrl={photoUrl}
        showAllSemesters={showAllSemesters}
        loading={loading}
        darkTheme
        onSelectSemester={(sheet) => void selectSemester(sheet)}
        onShowAllSemesters={() => setShowAllSemesters(true)}
      />
    </div>
  );
}
