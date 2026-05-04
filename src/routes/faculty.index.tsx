import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { StudentMarksheet } from "@/lib/marksheet";
import { normalizeMarksheet } from "@/lib/marksheet";
import { buildFacultyVerificationUpdate } from "@/lib/marksheet-verification";
import type { Student } from "@/lib/types";

export const Route = createFileRoute("/faculty/")({
  head: () => ({ meta: [{ title: "Faculty Portal — GCU" }] }),
  component: FacultyPage,
});

function FacultyPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marksheets, setMarksheets] = useState<StudentMarksheet[]>([]);
  const [legacyMarkCount, setLegacyMarkCount] = useState<Map<string, number>>(new Map());
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"roll" | "name" | "dept">("roll");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "pending" | "done">("all");

  async function load() {
    setLoading(true);
    const [
      { data: studentRows, error: studentError },
      { data: marksheetRows, error: marksheetError },
      { data: markRows, error: markErr },
    ] = await Promise.all([
      supabase.from("students").select("*").order("student_id", { ascending: true }),
      supabase.from("student_marksheets").select("*").order("updated_at", { ascending: false }),
      supabase.from("student_marks").select("student_id"),
    ]);

    if (studentError) toast.error(studentError.message);
    if (marksheetError) toast.error(marksheetError.message);
    if (markErr) toast.error(markErr.message);

    setStudents((studentRows as Student[]) ?? []);
    setMarksheets(
      ((marksheetRows as Record<string, unknown>[] | null) ?? []).map((row) =>
        normalizeMarksheet(row),
      ),
    );
    const countMap = new Map<string, number>();
    for (const row of (markRows ?? []) as { student_id: string }[]) {
      countMap.set(row.student_id, (countMap.get(row.student_id) ?? 0) + 1);
    }
    setLegacyMarkCount(countMap);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("faculty:students-and-marksheets")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_marksheets" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const marksheetByStudentId = useMemo(
    () => new Map(marksheets.map((marksheet) => [marksheet.student_id, marksheet])),
    [marksheets],
  );

  const rows = useMemo(
    () =>
      students.map((student) => ({
        student,
        marksheet: marksheetByStudentId.get(student.id) ?? null,
        legacyCourseCount: legacyMarkCount.get(student.id) ?? 0,
      })),
    [students, marksheetByStudentId, legacyMarkCount],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rows.filter(({ student }) => {
      if (!q) return true;
      return (
        student.full_name.toLowerCase().includes(q) ||
        student.student_id.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        student.department.toLowerCase().includes(q)
      );
    });

    if (verifiedFilter === "pending") {
      list = list.filter(({ student }) => !student.faculty_verified);
    } else if (verifiedFilter === "done") {
      list = list.filter(({ student }) => student.faculty_verified);
    }

    return [...list].sort((a, b) => {
      if (sortKey === "name") {
        return a.student.full_name.localeCompare(b.student.full_name);
      }
      if (sortKey === "dept") {
        return (
          a.student.department.localeCompare(b.student.department) ||
          a.student.student_id.localeCompare(b.student.student_id)
        );
      }
      return a.student.student_id.localeCompare(b.student.student_id);
    });
  }, [rows, searchQuery, sortKey, verifiedFilter]);

  async function toggleFacultyVerified(
    student: Student,
    marksheet: StudentMarksheet | null,
    legacyCourseCount: number,
  ) {
    const hasMarksData = Boolean(marksheet) || legacyCourseCount > 0;
    if (!hasMarksData && !student.faculty_verified) {
      toast.error("No marks are saved for this student yet.");
      return;
    }

    const next = !student.faculty_verified;
    setBusyStudentId(student.id);
    try {
      const { error } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(next))
        .eq("id", student.id);
      if (error) throw error;

      if (next) {
        await supabase.from("portal_notifications").insert({
          recipient_portal: "admin",
          sender_portal: "faculty",
          student_id: student.id,
          title: "Faculty marksheet verification complete",
          message: `${student.student_id} was verified by Faculty and is ready for Admin review.`,
        });
      }

      toast.success(next ? "Faculty verified marksheet" : "Faculty verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <h2 className="text-xl font-bold text-primary">Marksheet verification queue</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review marks from <strong>student_marksheets</strong> or subject rows in{" "}
        <strong>student_marks</strong> (bulk upload).
      </p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
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
        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Faculty status
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="all">All students</option>
            <option value="pending">Pending verification</option>
            <option value="done">Verified</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground lg:pb-2">
          Showing {filteredRows.length} of {rows.length} students
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading students and marks…</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Marksheet</th>
                <th className="px-2 py-2">Courses</th>
                <th className="px-2 py-2">SGPA</th>
                <th className="px-2 py-2">Final</th>
                <th className="px-2 py-2">Faculty Verified</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, marksheet, legacyCourseCount }) => {
                const courseCount = marksheet?.courses.length ?? legacyCourseCount;
                const hasMarks = Boolean(marksheet) || legacyCourseCount > 0;
                return (
                  <tr key={student.id} className="border-b border-border/60">
                    <td className="px-2 py-3">
                      <p className="font-medium text-primary">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.student_id}</p>
                    </td>
                    <td className="px-2 py-3">
                      {marksheet ? (
                        <div>
                          <p className="font-medium text-primary">
                            {marksheet.programme_code} · Sem {marksheet.semester_label}
                          </p>
                          <p className="text-xs text-muted-foreground">{marksheet.programme_title}</p>
                        </div>
                      ) : legacyCourseCount > 0 ? (
                        <div>
                          <p className="font-medium text-primary">Subject marks on file</p>
                          <p className="text-xs text-muted-foreground">{legacyCourseCount} courses</p>
                        </div>
                      ) : (
                        <span className="font-medium text-amber-700">Missing</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-primary">{courseCount}</td>
                    <td className="px-2 py-3">{marksheet ? marksheet.sgpa.toFixed(2) : "-"}</td>
                    <td className="px-2 py-3">{marksheet?.final_grade ?? "-"}</td>
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(student.faculty_verified)}
                        disabled={
                          busyStudentId === student.id || (!hasMarks && !student.faculty_verified)
                        }
                        onChange={() => void toggleFacultyVerified(student, marksheet, legacyCourseCount)}
                        aria-label={`Faculty verification for ${student.student_id}`}
                      />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Link
                        to="/faculty/students/$studentId"
                        params={{ studentId: student.id }}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-xs text-primary hover:bg-secondary"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No students match your search or filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
