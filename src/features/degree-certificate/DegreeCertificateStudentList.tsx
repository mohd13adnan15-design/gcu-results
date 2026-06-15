import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { fetchDegreeCertificateStudentRows } from "@/lib/degree-certificate/data";
import { subscribePostgresChanges } from "@/lib/supabase-realtime";

export function DegreeCertificateStudentList() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof fetchDegreeCertificateStudentRows>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"roll" | "name" | "dept">("roll");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchDegreeCertificateStudentRows(supabase);
      setRows(list);
    } catch (error) {
      console.error(error);
      toast.error("Could not load COE student list.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribePostgresChanges(
      "degree-cert:coe-students",
      [
        { event: "*", schema: "public", table: "students" },
        { event: "*", schema: "public", table: "student_marksheets" },
      ],
      () => void load(),
    );
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rows.filter((row) => {
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.rollNo.toLowerCase().includes(q) ||
        row.registrationNo.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.programmeTitle.toLowerCase().includes(q) ||
        row.programmeCode.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.fullName.localeCompare(b.fullName);
      if (sortKey === "dept") {
        return a.department.localeCompare(b.department) || a.rollNo.localeCompare(b.rollNo);
      }
      return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
    });
    return list;
  }, [rows, searchQuery, sortKey]);

  return (
    <div className="rounded-xl border border-border bg-cream p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">COE students</h2>
          <p className="text-xs text-muted-foreground">
            All students with marksheet data from the COE portal. New uploads appear automatically.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} students
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, roll, registration, department, programme…"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "roll" | "name" | "dept")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
          >
            <option value="roll">Roll number</option>
            <option value="name">Name</option>
            <option value="dept">Department</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading students…
        </div>
      ) : (
        <div className="mt-4 max-h-[520px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream">
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Registration</th>
                <th className="px-3 py-2">Programme</th>
                <th className="px-3 py-2 text-center">Semesters</th>
                <th className="px-3 py-2 text-center">CGPA</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.studentUuid} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium text-primary">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{row.rollNo}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.registrationNo}</td>
                  <td className="px-3 py-2">
                    <span className="text-primary">{row.programmeTitle}</span>
                    {row.programmeCode ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {row.programmeCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center">{row.semesterCount}</td>
                  <td className="px-3 py-2 text-center font-medium">{row.cgpaLabel}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/coe/degree-certificate/preview/${row.studentUuid}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-secondary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No COE marksheet data yet. Upload marks via the COE dashboard first."
                : "No students match your search."}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
