import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { buildMainGradeCardRows } from "@/lib/main-grade-card";
import type { Tables } from "@/integrations/supabase/types";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { GraduationCap, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

export type GradeCardDetailRow = Tables<"grade_card_details">;

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">What to fill: </span>
      {children}
    </p>
  );
}

export type GradeCardApplicationFormProps = {
  /** Student UUID (`students.id`). When null, pick from dropdown inside the form. */
  initialStudentId: string | null;
  students: Student[];
  onCancel: () => void;
  onSaved: () => void;
  /** When false, hides the Cancel control (e.g. embedded in Super Admin student hub). */
  showCancel?: boolean;
};

/** Full-page or embedded grade card header form (no modal). */
export function GradeCardApplicationForm({
  initialStudentId,
  students,
  onCancel,
  onSaved,
  showCancel = true,
}: GradeCardApplicationFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [programmeTitle, setProgrammeTitle] = useState("");
  const [programmeCode, setProgrammeCode] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [semesterLabel, setSemesterLabel] = useState("");
  const [examMonthYear, setExamMonthYear] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [semesterGpa, setSemesterGpa] = useState("");
  const [finalGrade, setFinalGrade] = useState("");

  const studentLocked = useMemo(() => Boolean(initialStudentId), [initialStudentId]);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const sid = initialStudentId ?? "";

        if (sid) {
          const { data, error } = await supabase
            .from("grade_card_details")
            .select("*")
            .eq("student_id", sid)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          const header = (data as GradeCardDetailRow | null) ?? null;
          const st = students.find((x) => x.id === sid);
          if (header) {
            setStudentId(header.student_id);
            setStudentName(header.student_name);
            setProgrammeTitle(header.programme_title);
            setProgrammeCode(header.programme_code);
            setRegistrationNo(header.registration_no ?? "");
            setSemesterLabel(header.semester_label ?? "");
            setExamMonthYear(header.exam_month_year ?? "");
            setIssueDate(header.issue_date ?? "");
            setSemesterGpa(header.semester_gpa != null ? String(header.semester_gpa) : "");
            setFinalGrade(header.final_grade ?? "");
          } else {
            setStudentId(sid);
            setStudentName(st?.full_name ?? "");
            setProgrammeTitle("");
            setProgrammeCode("");
            setRegistrationNo(st?.student_id ?? "");
            setSemesterLabel(st ? `Semester ${st.semester}` : "");
            setExamMonthYear("");
            setIssueDate("");
            setSemesterGpa("");
            setFinalGrade("");
          }
          return;
        }

        setStudentId("");
        setStudentName("");
        setProgrammeTitle("");
        setProgrammeCode("");
        setRegistrationNo("");
        setSemesterLabel("");
        setExamMonthYear("");
        setIssueDate("");
        setSemesterGpa("");
        setFinalGrade("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load grade card details");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [initialStudentId, students]);

  async function save() {
    const sid = studentId.trim();
    if (!sid) {
      toast.error("Choose a student (portal account) first.");
      return;
    }
    if (
      !studentName.trim() ||
      !programmeTitle.trim() ||
      !programmeCode.trim() ||
      !registrationNo.trim() ||
      !semesterLabel.trim() ||
      !examMonthYear.trim()
    ) {
      toast.error(
        "Student name, programme title, programme code, registration no, semester label, and exam month/year are required.",
      );
      return;
    }

    const gpaNum =
      semesterGpa.trim() === "" ? null : Number.parseFloat(semesterGpa.replace(",", "."));
    if (semesterGpa.trim() !== "" && Number.isNaN(gpaNum ?? NaN)) {
      toast.error("Semester SGPA must be a number (e.g. 8.45).");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        student_id: sid,
        student_name: studentName.trim(),
        programme_title: programmeTitle.trim(),
        programme_code: programmeCode.trim(),
        registration_no: registrationNo.trim(),
        semester_label: semesterLabel.trim(),
        exam_month_year: examMonthYear.trim(),
        row_number: 1,
        course_category: "HEADER",
        issue_date: issueDate.trim() || null,
        semester_gpa: gpaNum ?? 0,
        final_grade: finalGrade.trim() || null,
        total_credits: 0,
        total_credit_points: 0,
        updated_at: now,
        created_at: now,
      };

      const { error } = await supabase
        .from("grade_card_details")
        .upsert(payload, { onConflict: "student_id,row_number" });
      if (error) throw error;

      const [studentRes, marksRes] = await Promise.all([
        supabase.from("students").select("*").eq("id", sid).maybeSingle(),
        supabase.from("student_marks").select("*").eq("student_id", sid).order("created_at"),
      ]);
      const student = studentRes.data as Student | null;
      if (student) {
        const mainGradeRows = buildMainGradeCardRows(
          student,
          {
            student_name: studentName.trim(),
            programme_title: programmeTitle.trim(),
            programme_code: programmeCode.trim(),
            registration_no: registrationNo.trim(),
            semester_label: semesterLabel.trim(),
            exam_month_year: examMonthYear.trim(),
            issue_date: issueDate.trim() || null,
            semester_gpa: gpaNum ?? 0,
            final_grade: finalGrade.trim() || "",
          },
          ((marksRes.data as StudentMarkRow[]) ?? []).filter(Boolean),
        );
        await supabase.from("main_grade_card").delete().eq("student_id", sid);
        const { error: mainGradeError } = await supabase
          .from("main_grade_card")
          .insert(mainGradeRows);
        if (mainGradeError) throw mainGradeError;
      }

      toast.success("Grade card application saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Student UUID",
        "Student name",
        "Programme title",
        "Programme code",
        "Registration no",
        "Semester label",
        "Exam month/year",
        "Issue date (YYYY-MM-DD)",
        "Semester GPA",
        "Final grade",
      ],
      [
        "00000000-0000-0000-0000-000000000000",
        "Lekkala Prabhakar Reddy",
        "Bachelor of Computer Applications",
        "BCAR",
        "22BCAR241",
        "Semester 1",
        "March - 2023",
        "2023-06-13",
        8.45,
        "A+",
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "grade_card_details");
    XLSX.writeFile(wb, "grade_card_details_template.xlsx");
  }

  async function handleExcelFile(file: File) {
    setExcelBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        toast.error("The sheet is empty.");
        return;
      }

      const get = (r: Record<string, unknown>, k: string) => String(r[k] ?? "").trim();
      const parsed = rows
        .map((r) => {
          const student_id = get(r, "Student UUID");
          return {
            student_id,
            student_name: get(r, "Student name"),
            programme_title: get(r, "Programme title"),
            programme_code: get(r, "Programme code"),
            registration_no: get(r, "Registration no"),
            semester_label: get(r, "Semester label"),
            exam_month_year: get(r, "Exam month/year"),
            issue_date: get(r, "Issue date (YYYY-MM-DD)") || null,
            semester_gpa: Number(get(r, "Semester GPA") || 0) || 0,
            final_grade: get(r, "Final grade") || null,
            row_number: 1,
            course_category: "HEADER",
            course_code: null,
            course_title: null,
            course_credits: null,
            credits_earned: null,
            grade: null,
            grade_points: null,
            total_credit_points: 0,
            total_credits: 0,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
        })
        .filter((r) => r.student_id);

      if (parsed.length === 0) {
        toast.error("No valid rows found (need student UUID).");
        return;
      }

      const { error } = await supabase
        .from("grade_card_details")
        .upsert(parsed, { onConflict: "student_id,row_number" });
      if (error) throw error;
      toast.success(`Uploaded ${parsed.length} grade card rows.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary md:text-2xl">Grade card application</h2>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Enter official wording exactly as it should appear on the printed grade card. Required
          fields are marked with *.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary hover:bg-secondary"
        >
          Download Excel template
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {excelBusy ? "Uploading…" : "Upload Excel"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleExcelFile(f);
            }}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Student account *</label>
            <FieldHint>
              Pick the student who signs in on the portal — this links the grade card to their UUID
              in <code className="rounded bg-muted px-1">students</code>.
            </FieldHint>
            <select
              value={studentId}
              disabled={studentLocked}
              onChange={(e) => {
                const id = e.target.value;
                setStudentId(id);
                const st = students.find((x) => x.id === id);
                if (st) {
                  setStudentName((n) => (n.trim() ? n : st.full_name));
                  setRegistrationNo((r) => (r.trim() ? r : st.student_id));
                  setSemesterLabel((sl) => (sl.trim() ? sl : `Semester ${st.semester}`));
                }
              }}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_id} — {s.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Student name on card *</label>
            <FieldHint>
              Full legal name in title case or ALL CAPS to match the physical grade card.
            </FieldHint>
            <input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. Ayesha Khan"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Programme title *</label>
            <FieldHint>Full programme name line (e.g. B.Tech Computer Science).</FieldHint>
            <input
              value={programmeTitle}
              onChange={(e) => setProgrammeTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. B.Tech Computer Science"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Programme code *</label>
            <FieldHint>Short code printed beside the programme (e.g. BTECH-CSE).</FieldHint>
            <input
              value={programmeCode}
              onChange={(e) => setProgrammeCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. BTECH-CSE"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Registration number *</label>
            <FieldHint>
              Official registration / roll number on the card (often same as portal roll).
            </FieldHint>
            <input
              value={registrationNo}
              onChange={(e) => setRegistrationNo(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. 22BCAR241"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Semester label *</label>
            <FieldHint>Semester line as on template (e.g. Semester 3).</FieldHint>
            <input
              value={semesterLabel}
              onChange={(e) => setSemesterLabel(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. Semester 3"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Month & year of exam *</label>
            <FieldHint>Exam session text (e.g. December 2024).</FieldHint>
            <input
              value={examMonthYear}
              onChange={(e) => setExamMonthYear(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. December 2024"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Date of issue</label>
            <FieldHint>Issue date printed at bottom of card (e.g. 15 Jan 2025).</FieldHint>
            <input
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. 15 Jan 2025"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Semester SGPA</label>
            <FieldHint>
              Numeric SGPA for this semester; leave blank to derive from subject rows when possible.
            </FieldHint>
            <input
              value={semesterGpa}
              onChange={(e) => setSemesterGpa(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. 8.45"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Final grade</label>
            <FieldHint>
              Optional classification (e.g. Outstanding) if your template shows this field.
            </FieldHint>
            <input
              value={finalGrade}
              onChange={(e) => setFinalGrade(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2.5 text-sm"
              placeholder="e.g. A+"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {showCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-cream px-5 py-2.5 text-sm font-medium text-primary hover:bg-secondary"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void save()}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save application"}
        </button>
      </div>
    </div>
  );
}

type RowWithRoll = GradeCardDetailRow & { roll?: string };

export function GradeCardDetailsAdminPanel() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowWithRoll[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: detailRows, error: dErr }, { data: studentRows, error: sErr }] =
      await Promise.all([
        supabase.from("grade_card_details").select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from("students").select("*").order("student_id", { ascending: true }),
      ]);
    if (dErr) {
      toast.error(dErr.message);
      setRows([]);
    } else {
      const studs = (studentRows as Student[]) ?? [];
      const byId = new Map(studs.map((s) => [s.id, s.student_id]));
      setRows(
        ((detailRows as GradeCardDetailRow[]) ?? []).map((r) => ({
          ...r,
          roll: byId.get(r.student_id),
        })),
      );
    }
    if (sErr) toast.error(sErr.message);
    setStudents((studentRows as Student[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <GraduationCap className="h-5 w-5" />
            Grade card details (Supabase)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Data from <code className="rounded bg-muted px-1 text-xs">grade_card_details</code> —
            header lines for each student&apos;s printed card. Course rows still come from{" "}
            <code className="rounded bg-muted px-1 text-xs">student_marks</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse font-serif text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-sans">Student name</th>
                <th className="px-2 py-2 font-sans">Roll</th>
                <th className="px-2 py-2 font-sans">Programme</th>
                <th className="px-2 py-2 font-sans">Code</th>
                <th className="px-2 py-2 font-sans">Registration</th>
                <th className="px-2 py-2 font-sans">Semester</th>
                <th className="px-2 py-2 font-sans">Exam</th>
                <th className="px-2 py-2 font-sans">SGPA</th>
                <th className="px-2 py-2 font-sans">Final</th>
                <th className="px-2 py-2 font-sans">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium text-primary">{row.student_name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.roll ?? "—"}</td>
                  <td className="px-2 py-2">{row.programme_title}</td>
                  <td className="px-2 py-2">{row.programme_code}</td>
                  <td className="px-2 py-2">{row.registration_no ?? "—"}</td>
                  <td className="px-2 py-2">{row.semester_label ?? "—"}</td>
                  <td className="px-2 py-2">{row.exam_month_year ?? "—"}</td>
                  <td className="px-2 py-2">{row.semester_gpa != null ? row.semester_gpa : "—"}</td>
                  <td className="px-2 py-2">{row.final_grade ?? "—"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.updated_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No rows yet. Use the <strong>Grade card form</strong> button above or complete the
              migration so <code className="rounded bg-muted px-1 text-xs">grade_card_details</code>{" "}
              exists.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
