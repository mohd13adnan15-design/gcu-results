import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { GradeCardDetailsAdminPanel } from "@/components/GradeCardDetailsAdminPanel";
import type { PortalType, Student } from "@/lib/types";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  ShieldCheck,
  Upload,
  Download,
  FileSpreadsheet,
  Pencil,
  Save,
  PlusCircle,
  FilePenLine,
  Eye,
} from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/super-admin/")({
  head: () => ({ meta: [{ title: "Super Admin Portal — GCU" }] }),
  component: SuperAdminPage,
});

interface Admin {
  id: string;
  username: string;
  password: string;
  portal: PortalType;
  created_at: string;
}

function SuperAdminPage() {
  return (
    <AdminLayout
      requirePortal="super_admin"
      title="Super Admin Portal"
      subtitle="Manage credentials · Upload marks · Recheck data"
    >
      {() => <SuperAdminContent />}
    </AdminLayout>
  );
}

function SuperAdminContent() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          to="/super-admin/credentials"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
        >
          <ShieldCheck className="h-4 w-4" /> Manage credentials
        </Link>
      </div>

      <div className="card-elevated flex flex-col gap-3 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Grade card form</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill official grade card details (header + 11 rows) and save to Supabase.
          </p>
        </div>
        <Link
          to="/super-admin/grade-card-application"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <FilePenLine className="h-4 w-4" /> Open grade card form
        </Link>
      </div>
      <MarksUploader />
      <GradeCardDetailsAdminPanel />
      <MarksManagementPanel />
    </div>
  );
}

// --- Existing uploader/management panels copied from previous /super-admin route ---
// The rest of the file intentionally mirrors the existing Super Admin implementation.

const TEMPLATE_HEADERS = [
  "Student ID",
  "Email",
  "Password",
  "Student Name",
  "Department",
  "Semester",
  "Year",
  "Programme Title",
  "Programme Code",
  "Registration No",
  "Exam Month & Year",
  "Issue Date",
  "Semester Label",
  "Course Category",
  "Course Code",
  "Course Title",
  "Course Credits",
  "Credits Earned",
  "Marks Obtained",
  "Max Marks",
  "Grade Obtained",
  "Grade Points",
] as const;

type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

function gradePointsFromGrade(grade: string): number {
  switch (grade.toUpperCase()) {
    case "O":
      return 10;
    case "A+":
      return 9;
    case "A":
      return 8;
    case "B+":
      return 7;
    case "B":
      return 6;
    case "C":
      return 5;
    case "RA":
      return 0;
    default:
      return 0;
  }
}

function autoGrade(obtained: number, max: number): string {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  if (pct >= 90) return "O";
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B+";
  if (pct >= 50) return "B";
  if (pct >= 40) return "C";
  return "RA";
}

function assertStrictHeaders(rows: Record<string, unknown>[]) {
  const actual = Object.keys(rows[0] ?? {}).map((value) => value.trim());
  if (actual.length !== TEMPLATE_HEADERS.length) {
    throw new Error("Invalid template. Please use the downloaded Super Admin grade-card format.");
  }
  for (let i = 0; i < TEMPLATE_HEADERS.length; i += 1) {
    if (actual[i] !== TEMPLATE_HEADERS[i]) {
      throw new Error(`Invalid column at position ${i + 1}. Expected "${TEMPLATE_HEADERS[i]}".`);
    }
  }
}

function getValue(row: Record<string, unknown>, header: TemplateHeader): string {
  const value = row[header];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function MarksUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...TEMPLATE_HEADERS],
      [
        "22BCAR241",
        "22bcar241@gcu.edu.in",
        "student123",
        "Lekkala Prabhakar Reddy",
        "CSE",
        1,
        1,
        "Bachelor of Computer Applications",
        "BCAR",
        "22BCAR241",
        "March - 2023",
        "13 Jun 2023",
        "Semester 1",
        "CORE COURSE",
        "05ABCAR2111",
        "PROBLEM SOLVING TECHNIQUE USING C",
        2,
        0,
        35,
        100,
        "RA",
        0,
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, "marks_template.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        toast.error("The sheet is empty.");
        return;
      }
      assertStrictHeaders(rows);

      const parsed = rows.map((row) => {
        const student_id = getValue(row, "Student ID");
        const email = getValue(row, "Email").toLowerCase();
        const password = getValue(row, "Password") || "student123";
        const full_name = getValue(row, "Student Name");
        const department = getValue(row, "Department") || "CSE";
        const semester = Number(getValue(row, "Semester")) || 1;
        const year = Number(getValue(row, "Year")) || 1;
        const programme_title = getValue(row, "Programme Title");
        const programme_code = getValue(row, "Programme Code");
        const registration_no = getValue(row, "Registration No");
        const exam_month_year = getValue(row, "Exam Month & Year");
        const issue_date = getValue(row, "Issue Date");
        const semester_label = getValue(row, "Semester Label");
        const course_category = getValue(row, "Course Category") || "CORE COURSE";
        const subject_code = getValue(row, "Course Code");
        const subject = getValue(row, "Course Title");
        const credits = Number(getValue(row, "Course Credits")) || 0;
        const marks_obtained = Number(getValue(row, "Marks Obtained"));
        const max_marks = Number(getValue(row, "Max Marks")) || 100;
        const gradeRaw = getValue(row, "Grade Obtained").toUpperCase();
        const grade = gradeRaw || autoGrade(marks_obtained, max_marks);
        const credits_earned =
          Number(getValue(row, "Credits Earned")) || (grade === "RA" ? 0 : credits);
        const grade_points = Number(getValue(row, "Grade Points")) || gradePointsFromGrade(grade);
        return {
          student_id,
          email,
          password,
          full_name,
          department,
          semester,
          year,
          programme_title,
          programme_code,
          registration_no,
          exam_month_year,
          issue_date,
          semester_label,
          course_category,
          subject_code,
          subject,
          credits,
          credits_earned,
          marks_obtained,
          max_marks,
          grade,
          grade_points,
        };
      });

      const validRows = parsed.filter(
        (row) =>
          row.student_id &&
          row.email &&
          row.full_name &&
          row.subject_code &&
          row.subject &&
          Number.isFinite(row.credits) &&
          Number.isFinite(row.marks_obtained),
      );

      if (validRows.length === 0) {
        toast.error("No valid rows found in file.");
        return;
      }

      const uniqueEmails = Array.from(new Set(validRows.map((r) => r.email)));
      const uniqueIds = Array.from(new Set(validRows.map((r) => r.student_id)));

      const [existingByEmailRes, existingByStudentRes] = await Promise.all([
        uniqueEmails.length
          ? supabase.from("students").select("id, email, student_id").in("email", uniqueEmails)
          : Promise.resolve({ data: [], error: null }),
        uniqueIds.length
          ? supabase.from("students").select("id, email, student_id").in("student_id", uniqueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (existingByEmailRes.error) throw existingByEmailRes.error;
      if (existingByStudentRes.error) throw existingByStudentRes.error;

      const existingRows = [
        ...((existingByEmailRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
        ...((existingByStudentRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
      ];
      const existingByEmail = new Map(existingRows.map((row) => [row.email.toLowerCase(), row]));
      const existingByStudent = new Map(
        existingRows.map((row) => [row.student_id.toLowerCase(), row]),
      );

      const toInsertStudents = validRows
        .filter(
          (row) =>
            !existingByEmail.has(row.email) && !existingByStudent.has(row.student_id.toLowerCase()),
        )
        .map((row) => ({
          student_id: row.student_id,
          email: row.email,
          password: row.password,
          full_name: row.full_name,
          department: row.department,
          semester: row.semester,
          year: row.year,
          in_fees: true,
          in_hostel: false,
          in_library: false,
        }));
      if (toInsertStudents.length > 0) {
        const { error: insertStudentsError } = await supabase
          .from("students")
          .insert(toInsertStudents);
        if (insertStudentsError) throw insertStudentsError;
      }

      const [allByEmailRes, allByStudentRes] = await Promise.all([
        uniqueEmails.length
          ? supabase.from("students").select("id, email, student_id").in("email", uniqueEmails)
          : Promise.resolve({ data: [], error: null }),
        uniqueIds.length
          ? supabase.from("students").select("id, email, student_id").in("student_id", uniqueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (allByEmailRes.error) throw allByEmailRes.error;
      if (allByStudentRes.error) throw allByStudentRes.error;

      const allRows = [
        ...((allByEmailRes.data ?? []) as Array<{ id: string; email: string; student_id: string }>),
        ...((allByStudentRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
      ];
      const idByEmail = new Map(allRows.map((row) => [row.email.toLowerCase(), row.id]));
      const idByStudent = new Map(allRows.map((row) => [row.student_id.toLowerCase(), row.id]));

      const insertRows = validRows
        .map((row) => ({
          student_id:
            idByEmail.get(row.email) ?? idByStudent.get(row.student_id.toLowerCase()) ?? "",
          course_category: row.course_category,
          subject: row.subject,
          subject_code: row.subject_code,
          credits: row.credits,
          credits_earned: row.credits_earned,
          marks_obtained: row.marks_obtained,
          max_marks: row.max_marks,
          grade: row.grade,
          grade_points: row.grade_points,
        }))
        .filter((row) => row.student_id !== "");

      if (insertRows.length === 0) {
        toast.error("No students matched.");
        return;
      }

      const matchedStudentIds = Array.from(new Set(insertRows.map((row) => row.student_id)));
      if (replace) {
        const { error: deleteError } = await supabase
          .from("student_marks")
          .delete()
          .in("student_id", matchedStudentIds);
        if (deleteError) throw deleteError;
      }
      const { error: insertError } = await supabase.from("student_marks").insert(insertRows);
      if (insertError) throw insertError;

      const nowIso = new Date().toISOString();
      const rowCounter = new Map<string, number>();
      const mainGradeCardRows = validRows
        .map((row) => {
          const sid =
            idByEmail.get(row.email) ?? idByStudent.get(row.student_id.toLowerCase()) ?? "";
          if (!sid) return null;
          const nextRow = (rowCounter.get(sid) ?? 0) + 1;
          rowCounter.set(sid, nextRow);
          if (nextRow > 11) return null;
          return {
            student_id: sid,
            programme_title: row.programme_title || "Bachelor of Computer Applications",
            programme_code: row.programme_code || "BCAR",
            student_name: row.full_name,
            registration_no: row.registration_no || row.student_id,
            semester_label: row.semester_label || `Semester ${row.semester}`,
            exam_month_year: row.exam_month_year || "",
            row_number: nextRow,
            course_code: row.subject_code || null,
            course_title: row.subject || null,
            course_credits: Number.isFinite(row.credits) ? row.credits : null,
            credits_earned: Number.isFinite(row.credits_earned) ? row.credits_earned : null,
            grade: row.grade || null,
            grade_points: Number.isFinite(row.grade_points) ? row.grade_points : null,
            course_category: row.course_category || "CORE COURSE",
            total_credit_points: 0,
            total_credits: 0,
            semester_gpa: 0,
            final_grade: row.grade || null,
            issue_date: row.issue_date || null,
            qr_data: `${row.student_id}|${row.email}|${row.subject_code}|${row.subject}`,
            photo_url: null,
            updated_at: nowIso,
            created_at: nowIso,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (mainGradeCardRows.length > 0) {
        const { error: mainGradeCardError } = await supabase
          .from("main_grade_card")
          .upsert(mainGradeCardRows, { onConflict: "student_id,row_number" });
        if (mainGradeCardError) throw mainGradeCardError;

        const { error: gradeCardError } = await supabase
          .from("grade_card_details")
          .upsert(
            mainGradeCardRows
              .filter((row) => row.row_number === 1)
              .map((row) => ({
                student_id: row.student_id,
                student_name: row.student_name,
                programme_title: row.programme_title,
                programme_code: row.programme_code,
                registration_no: row.registration_no,
                semester_label: row.semester_label,
                exam_month_year: row.exam_month_year,
                issue_date: row.issue_date,
                semester_gpa: row.semester_gpa,
                final_grade: row.final_grade,
                updated_at: nowIso,
                created_at: nowIso,
              })),
            { onConflict: "student_id" },
          );
        if (gradeCardError) throw gradeCardError;
      }

      await supabase
        .from("students")
        .update({ faculty_verified: false, admin_verified: false, fully_verified: false })
        .in("id", matchedStudentIds);

      toast.success(
        `Uploaded ${insertRows.length} mark rows and ${mainGradeCardRows.length} main grade card rows.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <FileSpreadsheet className="h-5 w-5" /> Upload student marks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the strict grade-card Excel format only.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
        >
          <Download className="h-4 w-4" /> Download template
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload Excel"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Replace existing marks for matched students
        </label>
      </div>
    </div>
  );
}

function MarksManagementPanel() {
  const [students, setStudents] = useState<
    Array<{
      id: string;
      student_id: string;
      full_name: string;
      programme_title: string | null;
      programme_code: string | null;
      registration_no: string | null;
      semester_label: string | null;
      exam_month_year: string | null;
      semester_gpa: number | null;
      final_grade: string | null;
      total_credits: number | null;
      total_credit_points: number | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("main_grade_card")
      .select(
        "student_id,student_name,programme_title,programme_code,registration_no,semester_label,exam_month_year,semester_gpa,final_grade,total_credits,total_credit_points,students(id,student_id,full_name)",
      )
      .eq("row_number", 1)
      .order("student_name", { ascending: true });
    if (error) {
      toast.error(error.message);
      setStudents([]);
      setLoading(false);
      return;
    }

    const unique = new Map<string, (typeof students)[number]>();
    (data ?? []).forEach((row: any) => {
      const student = row.students ?? {};
      const key = row.student_id as string;
      if (!unique.has(key)) {
        unique.set(key, {
          id: student.id ?? row.student_id,
          student_id: student.student_id ?? row.student_name ?? "-",
          full_name: student.full_name ?? row.student_name ?? "-",
          programme_title: row.programme_title ?? null,
          programme_code: row.programme_code ?? null,
          registration_no: row.registration_no ?? null,
          semester_label: row.semester_label ?? null,
          exam_month_year: row.exam_month_year ?? null,
          semester_gpa: row.semester_gpa ?? null,
          final_grade: row.final_grade ?? null,
          total_credits: row.total_credits ?? null,
          total_credit_points: row.total_credit_points ?? null,
        });
      }
    });
    setStudents(Array.from(unique.values()));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("super-admin:main-grade-card")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "main_grade_card" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Main grade card records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Data shown here is loaded from <strong>main_grade_card</strong> and includes the
            summary row for each student.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Programme</th>
                <th className="px-2 py-2">Semester</th>
                <th className="px-2 py-2">Exam Month</th>
                <th className="px-2 py-2">SGPA</th>
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2">Credits</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <p className="font-medium text-primary">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">{row.student_id}</p>
                    <p className="text-xs text-muted-foreground">{row.registration_no}</p>
                  </td>
                  <td className="px-2 py-2">
                    <p className="text-primary">{row.programme_title ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{row.programme_code ?? "-"}</p>
                  </td>
                  <td className="px-2 py-2">{row.semester_label ?? "-"}</td>
                  <td className="px-2 py-2">{row.exam_month_year ?? "-"}</td>
                  <td className="px-2 py-2">{row.semester_gpa?.toFixed(2) ?? "-"}</td>
                  <td className="px-2 py-2">{row.final_grade ?? "-"}</td>
                  <td className="px-2 py-2">
                    {row.total_credits != null ? row.total_credits.toFixed(1) : "-"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      to="/super-admin/students/$studentId"
                      params={{ studentId: row.id }}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-xs text-primary hover:bg-secondary"
                    >
                      <Eye className="h-3.5 w-3.5" /> View / Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
