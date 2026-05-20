import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { PortalType, Student } from "@/lib/types";
import { toast } from "sonner";
import {
  ShieldCheck,
  Upload,
  Download,
  FileSpreadsheet,
  Eye,
  Loader2,
  MessageSquareWarning,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";

import {
  MARKS_TEMPLATE_HEADERS_FULL,
  buildTejashviTemplateExampleRows,
  normalizeExcelRowKeys,
  parseMarksTemplateRow,
  validateMarksTemplateColumns,
  type ParsedMarksCourseRow,
} from "@/lib/marks-excel-template";
import {
  calculateMarksheetTotals,
  legacyMarkRowsToMarksheetCourses,
} from "@/lib/marksheet";
import { notificationPortalLabel } from "@/lib/portal";

export function SuperAdminPage() {
  return (
    <AdminLayout
      requirePortal={["admin_1", "head_of_coe"]}
      title="COE"
      tagline="THE ARCHITECT OF ACCURACY. YOUR PRECISION BUILDS THE FOUNDATION OF EVERY STUDENT'S SUCCESS."
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
          to="/coe/credentials"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
        >
          <ShieldCheck className="h-4 w-4" /> Manage credentials
        </Link>
      </div>

      <SuperAdminIssueReports />
      <MarksUploader />
      <SuperAdminStudentsDashboard />
    </div>
  );
}

type IssueReportRow = {
  id: string;
  title: string;
  message: string;
  sender_portal: PortalType;
  student_id: string | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

function SuperAdminIssueReports() {
  const [rows, setRows] = useState<IssueReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_notifications")
      .select(
        "id,title,message,sender_portal,student_id,is_read,is_resolved,resolved_at,created_at",
      )
      .eq("recipient_portal", "head_of_coe")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as IssueReportRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("head-of-coe:issue-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_notifications" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function markRead(id: string) {
    await supabase.from("portal_notifications").update({ is_read: true }).eq("id", id);
    await load();
  }

  async function markSolved(row: any) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("portal_notifications")
      .update({ is_resolved: true, resolved_at: now, is_read: true })
      .eq("id", row.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (row.sender_portal) {
      await supabase.from("portal_notifications").insert({
        recipient_portal: row.sender_portal,
        sender_portal: "head_of_coe",
        student_id: row.student_id,
        title: "Issue Resolved by COE",
        message: `The issue you reported has been resolved: ${row.title}`,
      });
    }

    toast.success("Marked solved");
    await load();
  }

  async function deleteReport(id: string) {
    if (!confirm("Permanently delete this report?")) return;
    const { error } = await supabase.from("portal_notifications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Report deleted");
    await load();
  }

  const openReports = rows.filter((r) => !r.is_resolved);
  const solvedReports = rows.filter((r) => r.is_resolved);

  function ReportCard({
    row,
    showSolvedAction,
  }: {
    row: IssueReportRow;
    showSolvedAction: boolean;
  }) {
    return (
      <div
        className={`rounded-xl border p-4 text-sm ${row.is_read ? "border-border bg-secondary/20" : "border-primary/25 bg-accent/30"
          }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-primary">{row.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From <strong>{notificationPortalLabel(String(row.sender_portal))}</strong> ·{" "}
              {new Date(row.created_at).toLocaleString()}
              {row.resolved_at ? <> · Solved {new Date(row.resolved_at).toLocaleString()}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!row.is_read && (
              <button
                type="button"
                onClick={() => void markRead(row.id)}
                className="rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
              >
                Mark read
              </button>
            )}
            {showSolvedAction && !row.is_resolved ? (
              <button
                type="button"
                onClick={() => void markSolved(row)}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Solved
              </button>
            ) : null}
            {row.student_id ? (
              <Link
                to={`/coe/students/${row.student_id}`}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
              >
                <Eye className="h-3.5 w-3.5" /> Open student
              </Link>
            ) : null}
            {row.is_resolved && (
              <button
                type="button"
                onClick={() => void deleteReport(row.id)}
                className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/15"
                title="Permanently delete this solved report"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-muted-foreground">{row.message}</p>
      </div>
    );
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <MessageSquareWarning className="h-5 w-5" />
            Admin Reports
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading reports…
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No reports yet.</p>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-primary">Open ({openReports.length})</h3>
            {openReports.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No open reports.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {openReports.map((row) => (
                  <ReportCard key={row.id} row={row} showSolvedAction />
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground">
              Solved ({solvedReports.length})
            </h3>
            {solvedReports.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No solved items yet.</p>
            ) : (
              <div className="mt-3 space-y-3 opacity-90">
                {solvedReports.map((row) => (
                  <ReportCard key={row.id} row={row} showSolvedAction={false} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

type GradeHeaderRow = {
  student_id: string;
  programme_title: string | null;
  programme_code: string | null;
  semester_label: string | null;
  semester_gpa: number | null;
  final_grade: string | null;
  updated_at?: string | null;
};

function SuperAdminStudentsDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [headersByStudent, setHeadersByStudent] = useState<Map<string, GradeHeaderRow>>(new Map());
  const [courseCountByStudent, setCourseCountByStudent] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"roll" | "name" | "dept">("roll");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: studentRows, error: sErr }, { data: detailRows }, { data: markRows }] =
      await Promise.all([
        supabase.from("students").select("*").order("student_id", { ascending: true }),
        supabase
          .from("grade_card_details")
          .select(
            "student_id,programme_title,programme_code,semester_label,semester_gpa,final_grade,updated_at",
          ),
        supabase.from("student_marks").select("student_id"),
      ]);
    if (sErr) toast.error(sErr.message);
    setStudents((studentRows as Student[]) ?? []);

    const sortedDetails = [...((detailRows ?? []) as GradeHeaderRow[])].sort((a, b) =>
      String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
    );
    const headerMap = new Map<string, GradeHeaderRow>();
    for (const row of sortedDetails) {
      if (!headerMap.has(row.student_id)) {
        headerMap.set(row.student_id, row);
      }
    }
    setHeadersByStudent(headerMap);

    const counts = new Map<string, number>();
    for (const r of (markRows ?? []) as { student_id: string }[]) {
      counts.set(r.student_id, (counts.get(r.student_id) ?? 0) + 1);
    }
    setCourseCountByStudent(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("head-of-coe:students-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grade_card_details" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_marks" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = students.filter((s) => {
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.full_name.localeCompare(b.full_name);
      if (sortKey === "dept") {
        return a.department.localeCompare(b.department) || a.student_id.localeCompare(b.student_id);
      }
      return a.student_id.localeCompare(b.student_id);
    });
    return list;
  }, [students, searchQuery, sortKey]);

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div>
        <h2 className="text-lg font-bold text-primary">All students</h2>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll number, email, or department…"
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "roll" | "name" | "dept")}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="roll">Roll number</option>
            <option value="name">Name</option>
            <option value="dept">Department</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground md:pb-2">
          Showing {filtered.length} of {students.length} students
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading students…</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Department</th>
                <th className="px-2 py-2">Programme</th>
                <th className="px-2 py-2">Semester</th>
                <th className="px-2 py-2">Courses</th>
                <th className="px-2 py-2">SGPA</th>
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const h = headersByStudent.get(student.id);
                const n = courseCountByStudent.get(student.id) ?? 0;
                return (
                  <tr key={student.id} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      <p className="font-medium text-primary">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.student_id}</p>
                    </td>
                    <td className="px-2 py-2">{student.department}</td>
                    <td className="px-2 py-2">
                      <span className="text-primary">{h?.programme_title ?? "-"}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {h?.programme_code ?? ""}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {h?.semester_label ?? `Semester ${student.semester}`}
                    </td>
                    <td className="px-2 py-2">{n}</td>
                    <td className="px-2 py-2">
                      {h?.semester_gpa != null ? Number(h.semester_gpa).toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2">{h?.final_grade ?? "-"}</td>
                    <td className="px-2 py-2 text-right">
                      <Link
                        to={`/coe/students/${student.id}`}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-xs text-primary hover:bg-secondary"
                      >
                        <Eye className="h-3.5 w-3.5" /> View / Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No students match your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MarksUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    window.location.href = "/marks_template_final.xlsx";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);

    console.group("COE Marks Upload Debug");
    console.log("File received:", file.name, file.size, "bytes");

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellFormula: false, cellHTML: false, cellText: false, cellDates: true });
      const sheetName = wb.SheetNames[0]; // Always read the first sheet safely
      const sheet = wb.Sheets[sheetName];

      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", blankrows: false });

      if (aoa.length === 0) {
        toast.error("The sheet is empty.");
        console.groupEnd();
        return;
      }

      let headerRowIndex = 0;
      let finalHeaders: string[] = [];
      const row0 = aoa[0] || [];
      const row1 = aoa.length > 1 ? aoa[1] : [];

      const isSingleRowHeader = String(row0[0] || '').trim() === 'Sl No' && String(row0[1] || '').trim() === 'Email' && String(row0[2] || '').trim() === 'Student Name';
      
      const isGrouped = !isSingleRowHeader && row1.some(c => typeof c === 'string' && (c.toLowerCase().trim() === 'theory' || c.toLowerCase().trim() === 'practical'));

      if (isGrouped) {
        headerRowIndex = 1;
        const isGCUFormat = String(row0[0] || '').trim() === 'Sl No' && String(row0[1] || '').trim() === 'Email' && String(row0[16] || '').trim() === 'Course Code';
        
        if (isGCUFormat) {
          finalHeaders = [
            "Sl No", "Email", "Student Name", "Department", "University", "School Name", 
            "Programme Title", "Programme Code", "Registration No", "Exam Month & Year", 
            "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type", 
            "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned", 
            "CIA Max Marks Theory", "CIA Max Marks Practical", "CIA Marks Obtained Theory", "CIA Marks Obtained Practical", 
            "ESE Max Marks Theory", "ESE Max Marks Practical", "ESE Marks Obtained Theory", "ESE Marks Obtained Practical", 
            "Total Marks Theory", "Total Marks Practical", "Grade Obtained", "Grade Points"
          ];
        } else {
          let lastMainHeader = "";
          for (let i = 0; i < Math.max(row0.length, row1.length); i++) {
            const top = String(row0[i] || "").trim();
            if (top) lastMainHeader = top;
  
            const sub = String(row1[i] || "").trim();
            if (sub && lastMainHeader) {
              finalHeaders[i] = `${lastMainHeader} ${sub}`;
            } else if (sub) {
              finalHeaders[i] = sub;
            } else if (lastMainHeader) {
              finalHeaders[i] = lastMainHeader;
            } else {
              finalHeaders[i] = `Column${i}`;
            }
          }
        }
      } else {
        headerRowIndex = 0;
        finalHeaders = row0.map((c, i) => String(c || `Column${i}`).trim());
      }

      const rows: Record<string, unknown>[] = [];
      for (let i = headerRowIndex + 1; i < aoa.length; i++) {
        const rowData = aoa[i];
        if (!rowData || rowData.length === 0 || rowData.every(c => c === "" || c === null || c === undefined)) continue;

        const obj: Record<string, unknown> = {};
        for (let j = 0; j < finalHeaders.length; j++) {
          obj[finalHeaders[j]] = rowData[j] ?? "";
        }
        rows.push(obj);
      }

      console.log("Total raw rows read:", rows.length);

      if (rows.length === 0) {
        toast.error("The sheet is empty.");
        console.groupEnd();
        return;
      }

      // 1. Normalize Headers and Validate
      const sample = rows[0] || {};
      validateMarksTemplateColumns(sample);
      console.log("Header validation passed.");

      // 2. Parse Rows with logging
      const parsed: ParsedMarksCourseRow[] = [];
      const rejected: { row: number; reason: string }[] = [];

      rows.forEach((row, idx) => {
        const normalized = normalizeExcelRowKeys(row);
        const p = parseMarksTemplateRow(normalized);
        if (p) {
          parsed.push(p);
        } else {
          rejected.push({
            row: idx + 2,
            reason: "Missing critical fields: Student ID, Name, Course Code or Course Title"
          });
        }
      });

      console.log("Successfully parsed rows:", parsed.length);
      console.log("Rejected rows:", rejected.length);

      if (parsed.length === 0) {
        toast.error(`No valid rows found. ${rejected.length} rows were rejected due to missing critical fields.`);
        console.groupEnd();
        return;
      }

      // 3. Group and Process Students
      // We use upsert for students to ensure they exist and have latest metadata (name, dept)
      const studentsMap = new Map<string, any>();
      parsed.forEach(row => {
        const sid = row.student_id.toLowerCase().trim();
        if (!studentsMap.has(sid)) {
          studentsMap.set(sid, {
            student_id: row.student_id.trim(),
            email: row.email.toLowerCase().trim(),
            full_name: row.full_name.trim(),
            department: row.department || "General",
            semester: Number(row.semester) || 1,
            year: Number(row.year) || 1,
            in_fees: true, // Auto-add to portals if they are in marksheet
            in_hostel: false,
            in_library: false,
          });
        }
      });

      console.log("Unique students to sync:", studentsMap.size);

      // Upsert students (onConflict: student_id)
      const { data: studentSyncData, error: studentSyncErr } = await supabase
        .from("students")
        .upsert(Array.from(studentsMap.values()), { onConflict: "student_id" })
        .select("id, student_id");

      if (studentSyncErr) {
        console.error("Student sync error:", studentSyncErr);
        throw new Error(`Failed to sync students: ${studentSyncErr.message}`);
      }

      const idLookup = new Map<string, string>();
      studentSyncData.forEach(s => idLookup.set(s.student_id.toLowerCase(), s.id));

      // 4. Prepare Marks and Grade Card Rows
      const marksToInsert: any[] = [];
      const gradeCardRows: any[] = [];
      const studentExtras = new Map<string, any>();
      const nowIso = new Date().toISOString();
      const rowCounter = new Map<string, number>();

      parsed.forEach(row => {
        const sid = row.student_id.toLowerCase().trim();
        const uuid = idLookup.get(sid);
        if (!uuid) return;

        // Subject marks
        marksToInsert.push({
          student_id: uuid,
          course_category: row.course_category || "CORE COURSE",
          subject: row.subject,
          subject_code: row.subject_code,
          course_priority: row.course_priority,
          credits: row.credits,
          credits_earned: row.credits_earned,
          cia_max_marks_theory: row.cia_max_marks_theory,
          cia_max_marks_practical: row.cia_max_marks_practical,
          cia_marks_obtained_theory: row.cia_marks_obtained_theory,
          cia_marks_obtained_practical: row.cia_marks_obtained_practical,
          ese_max_marks_theory: row.ese_max_marks_theory,
          ese_max_marks_practical: row.ese_max_marks_practical,
          ese_marks_obtained_theory: row.ese_marks_obtained_theory,
          ese_marks_obtained_practical: row.ese_marks_obtained_practical,
          total_marks_theory: row.total_marks_theory,
          total_marks_practical: row.total_marks_practical,
          marks_obtained: row.marks_obtained,
          max_marks: row.max_marks,
          grade: row.grade,
          grade_points: row.grade_points,
        });

        // Main grade card (limit to 40 rows per student)
        const nextRow = (rowCounter.get(uuid) ?? 0) + 1;
        rowCounter.set(uuid, nextRow);
        if (nextRow <= 40) {
          gradeCardRows.push({
            student_id: uuid,
            programme_title: row.programme_title || "Bachelor Degree",
            programme_code: row.programme_code || "GEN",
            student_name: row.full_name,
            registration_no: row.registration_no || row.student_id,
            semester_label: row.semester_label || `Semester ${row.semester}`,
            exam_month_year: row.exam_month_year || "",
            row_number: nextRow,
            course_code: row.subject_code,
            course_title: row.subject,
            course_credits: row.credits,
            credits_earned: row.credits_earned,
            grade: row.grade,
            grade_points: row.grade_points,
            course_category: row.course_category || "CORE COURSE",
            total_credit_points: 0,
            total_credits: 0,
            semester_gpa: 0,
            final_grade: row.grade,
            issue_date: row.issue_date || null,
            qr_data: `${row.student_id}|${row.email}|${row.subject_code}`,
            updated_at: nowIso,
            created_at: nowIso,
          });
        }

        // Extras for marksheet sync
        if (!studentExtras.has(uuid)) {
          studentExtras.set(uuid, {
            university: row.university,
            school_name: row.school_name,
            grade_card_no: row.grade_card_no,
            qr_data: `GCU|${row.student_id}|${row.registration_no || row.student_id}|${row.full_name}|${row.programme_code}|${row.semester_label}`,
            exam_month_year: row.exam_month_year,
            issue_date: row.issue_date,
            programme_title: row.programme_title,
            programme_code: row.programme_code,
            student_name: row.full_name,
            registration_no: row.registration_no || row.student_id,
            semester_label: row.semester_label
          });
        }
      });

      console.log("Total marks records:", marksToInsert.length);

      // 5. Delete old marks if replace is checked
      const studentUuids = Array.from(idLookup.values());
      if (replace && studentUuids.length > 0) {
        console.log("Replacing existing marks for students:", studentUuids.length);

        await supabase
          .from("student_marks")
          .delete()
          .in("student_id", studentUuids);

        await supabase
          .from("main_grade_card")
          .delete()
          .in("student_id", studentUuids);
      }

      // 6. Insert Marks
      const { error: markErr } = await supabase.from("student_marks").insert(marksToInsert);
      if (markErr) {
        console.error("Marks insert error:", markErr);
        throw new Error(`Failed to insert marks: ${markErr.message}`);
      }

      // 7. Upsert Main Grade Card Rows
      if (gradeCardRows.length > 0) {
        const { error: gcErr } = await supabase
          .from("main_grade_card")
          .upsert(gradeCardRows, { onConflict: "student_id,row_number" });
        if (gcErr) console.error("Grade card upsert error:", gcErr);
      }

      // 8. Reset Verification Status and set marks_uploaded_at
      await supabase
        .from("students")
        .update({
          faculty_verified: false,
          admin_verified: false,
          fully_verified: false,
          marksheet_verification_requested_at: null,
          marks_uploaded_at: new Date().toISOString(),
        })
        .in("id", studentUuids);

      // 9. End-to-end Sync (SGPA, JSON Marksheet, Grade Card Details)
      const marksheetsToUpsert = [];
      const uniqueGradeCardDetails = new Map<string, any>();
      const nowIso2 = new Date().toISOString();

      // Group parsed rows by student UUID and semester_label
      const groupedMarks = new Map<string, ParsedMarksCourseRow[]>();
      parsed.forEach(row => {
        const sid = row.student_id.toLowerCase().trim();
        const uuid = idLookup.get(sid);
        if (!uuid) return;
        const semLabel = row.semester_label || `Semester ${row.semester}`;
        const key = `${uuid}|||${semLabel}`;
        if (!groupedMarks.has(key)) groupedMarks.set(key, []);
        groupedMarks.get(key)!.push(row);
      });

      for (const [key, rows] of groupedMarks.entries()) {
        const [uuid, semLabel] = key.split("|||");

        const courses = legacyMarkRowsToMarksheetCourses(rows as any);
        const totals = calculateMarksheetTotals(courses);

        const firstRow = rows[0];

        marksheetsToUpsert.push({
          student_id: uuid,
          student_roll_no: firstRow.registration_no || firstRow.student_id,
          university: firstRow.university,
          school_name: firstRow.school_name,
          programme_title: firstRow.programme_title,
          programme_code: firstRow.programme_code,
          student_name: firstRow.full_name,
          registration_no: firstRow.registration_no || firstRow.student_id,
          semester_label: semLabel,
          exam_month_year: firstRow.exam_month_year,
          issue_date: firstRow.issue_date,
          grade_card_no: firstRow.grade_card_no,
          qr_data: `GCU|${firstRow.student_id}|${firstRow.registration_no || firstRow.student_id}|${firstRow.full_name}|${firstRow.programme_code}|${semLabel}`,
          photo_bucket: "student-photos",
          photo_path: `${firstRow.registration_no || firstRow.student_id}/profile.jpeg`,
          total_credits: totals.totalCredits,
          total_credits_earned: totals.totalCreditsEarned,
          total_credit_points: totals.totalCreditPoints,
          sgpa: totals.sgpa,
          final_grade: totals.finalGrade,
          courses: courses as any,
          created_at: nowIso2,
          updated_at: nowIso2,
        });

        uniqueGradeCardDetails.set(uuid, {
          student_id: uuid,
          student_name: firstRow.full_name,
          programme_title: firstRow.programme_title,
          programme_code: firstRow.programme_code,
          registration_no: firstRow.registration_no || firstRow.student_id,
          semester_label: semLabel,
          exam_month_year: firstRow.exam_month_year,
          issue_date: firstRow.issue_date,
          semester_gpa: totals.sgpa,
          final_grade: totals.finalGrade,
          updated_at: nowIso2,
          created_at: nowIso2,
        });
      }

      if (marksheetsToUpsert.length > 0) {
        const { error: msErr } = await supabase.from("student_marksheets").upsert(
          marksheetsToUpsert,
          { onConflict: "student_id,semester_label" }
        );
        if (msErr) console.error("Marksheet upsert error:", msErr);
      }

      if (uniqueGradeCardDetails.size > 0) {
        const { error: gcErr } = await supabase.from("grade_card_details").upsert(
          Array.from(uniqueGradeCardDetails.values()),
          { onConflict: "student_id" }
        );
        if (gcErr) console.error("Grade Card Details upsert error:", gcErr);
      }

      console.log("Successfully synced students:", marksheetsToUpsert.length);

      const successCount = parsed.length;
      const studentCount = studentsMap.size;
      const failCount = rejected.length;

      if (failCount > 0) {
        const firstFew = rejected.slice(0, 3).map(r => `Row ${r.row}: ${r.reason}`).join("\n");
        toast.error(
          `Upload partially successful.\n` +
          `✅ ${successCount} rows parsed (${studentCount} students).\n` +
          `❌ ${failCount} rows failed validation.\n` +
          `First few errors:\n${firstFew}${failCount > 3 ? "\n...see console for more" : ""}`,
          { duration: 6000 }
        );
        console.table(rejected);
      } else {
        toast.success(
          `Successfully processed ${successCount} rows for ${studentCount} students. ` +
          `All grade cards generated and synced.`
        );
      }

    } catch (error) {
      console.error("Critical Upload Failure:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed unexpectedly.");
    } finally {
      console.groupEnd();
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <FileSpreadsheet className="h-5 w-5" /> Upload student marks
          </h2>

        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
        >
          <Download className="h-4 w-4" /> Download template
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
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
