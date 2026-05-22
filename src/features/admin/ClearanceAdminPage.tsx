import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { DEPARTMENTS, SEMESTERS, YEARS } from "@/lib/types";
import { toRoman, romanToNum } from "@/lib/marks-excel-template";
import { toast } from "sonner";
import { Trash2, Search, CheckCircle2, Upload, Download, Pencil, Save, X, Plus } from "lucide-react";
import { fetchDepartments, insertDepartment } from "@/lib/departments-db";
import * as XLSX from "xlsx";

type Kind = "library" | "hostel" | "fees";

interface Props {
  kind: Kind;
}

const FIELD: Record<Kind, { membership: keyof Student; cleared: keyof Student; label: string }> = {
  library: { membership: "in_library", cleared: "library_cleared", label: "All books returned" },
  hostel: { membership: "in_hostel", cleared: "hostel_cleared", label: "Hostel fees paid" },
  fees: { membership: "in_fees", cleared: "fees_cleared", label: "Academic fees paid" },
};

// Money-bearing portals: which DB columns carry the paid/total amounts.
type MoneyKind = "fees" | "hostel";
const MONEY: Record<
  MoneyKind,
  { paid: keyof Student; total: keyof Student; portalLabel: string; defaultTotal: number }
> = {
  fees: {
    paid: "fees_paid",
    total: "fees_total",
    portalLabel: "academic fees",
    defaultTotal: 100000,
  },
  hostel: {
    paid: "hostel_paid",
    total: "hostel_total",
    portalLabel: "hostel fees",
    defaultTotal: 50000,
  },
};

const ROLL_ALIASES = [
  "studentid",
  "studentidno",
  "studentno",
  "rollno",
  "roll",
  "rollnumber",
  "regno",
  "registrationno",
  "id",
  "sid",
  "usn",
];

const PAID_ALIASES = [
  "paid",
  "amount",
  "amountpaid",
  "feepaid",
  "feespaid",
  "hostelpaid",
  "hostelfeepaid",
  "totalpaid",
  "payment",
  "paidamount",
  "amountreceived",
];

const TOTAL_ALIASES = [
  "total",
  "totalfee",
  "totalfees",
  "feetotal",
  "feestotal",
  "hosteltotal",
  "totalhostel",
  "totalhostelfee",
  "totalamount",
];

function normalizeKey(k: string): string {
  return String(k)
    .toLowerCase()
    .replace(/[\s_\-./()]+/g, "")
    .trim();
}

function findColumn(row: Record<string, unknown>, aliases: readonly string[]): string | null {
  for (const k of Object.keys(row)) {
    if (aliases.includes(normalizeKey(k))) return k;
  }
  return null;
}

function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // Strip currency symbols, commas and whitespace, then parse.
  const cleaned = String(raw).replace(/[₹$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function ClearanceAdminPage({ kind }: Props) {
  const cfg = FIELD[kind];
  const money = kind === "fees" || kind === "hostel" ? MONEY[kind] : null;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("ALL");
  const [sem, setSem] = useState<string>("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [uploading, setUploading] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editPaid, setEditPaid] = useState<string>("");
  const [editTotal, setEditTotal] = useState<string>("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualData, setManualData] = useState({
    student_id: "",
    full_name: "",
    department: DEPARTMENTS[0] as string,
    semester: 1,
    year: 1,
    paid: "",
    total: "",
    cleared: false,
  });
  const [depts, setDepts] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Library Portal Books Management
  const [booksModalStudent, setBooksModalStudent] = useState<Student | null>(null);
  const [modalBooks, setModalBooks] = useState<any[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [newBookBorrowedAt, setNewBookBorrowedAt] = useState(new Date().toISOString().split("T")[0]);
  const [addingBook, setAddingBook] = useState(false);

  const loadStudentBooks = useCallback(async (studentId: string) => {
    setBooksLoading(true);
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .eq("student_id", studentId)
      .order("borrowed_at", { ascending: false });
    if (error) toast.error(error.message);
    setModalBooks(data || []);
    setBooksLoading(false);
  }, []);

  function openBooksModal(student: Student) {
    setBooksModalStudent(student);
    setNewBookTitle("");
    setNewBookAuthor("");
    setNewBookBorrowedAt(new Date().toISOString().split("T")[0]);
    void loadStudentBooks(student.id);
  }

  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    if (!booksModalStudent) return;
    if (!newBookTitle.trim()) {
      toast.error("Book title is required.");
      return;
    }
    setAddingBook(true);
    try {
      const payload = {
        student_id: booksModalStudent.id,
        title: newBookTitle.trim(),
        author: newBookAuthor.trim() || null,
        borrowed_at: newBookBorrowedAt || new Date().toISOString().split("T")[0],
        returned: false,
        returned_at: null,
      };
      const { error } = await supabase.from("library_books").insert(payload);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Book added successfully.");
        setNewBookTitle("");
        setNewBookAuthor("");
        void loadStudentBooks(booksModalStudent.id);
        void load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add book");
    } finally {
      setAddingBook(false);
    }
  }

  async function toggleBookReturned(bookId: string, currentStatus: boolean) {
    if (!booksModalStudent) return;
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from("library_books")
      .update({
        returned: nextStatus,
        returned_at: nextStatus ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", bookId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(nextStatus ? "Book marked as returned." : "Book marked as pending.");
      void loadStudentBooks(booksModalStudent.id);
      void load();
    }
  }

  async function deleteBook(bookId: string) {
    if (!booksModalStudent) return;
    if (!confirm("Are you sure you want to delete this book?")) return;
    const { error } = await supabase.from("library_books").delete().eq("id", bookId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Book deleted.");
      void loadStudentBooks(booksModalStudent.id);
      void load();
    }
  }

  useEffect(() => {
    async function loadDepts() {
      const list = await fetchDepartments();
      setDepts(list);
      setManualData((prev) => ({ ...prev, department: list[0] || "CSE" }));
    }
    void loadDepts();
  }, []);

  const load = useCallback(async () => {
    const membership = FIELD[kind].membership;
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq(membership as string, true)
      .order("student_id");
    if (error) toast.error(error.message);
    setStudents((data as Student[]) ?? []);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`clearance:${kind}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [kind, load]);

  const filtered = students.filter((s) => {
    if (dept !== "ALL" && s.department !== dept) return false;
    if (kind !== "library" && kind !== "hostel" && sem !== "ALL" && s.semester !== Number(sem)) return false;
    if (kind !== "library" && kind !== "hostel" && year !== "ALL" && s.year !== Number(year)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.full_name.toLowerCase().includes(q) &&
        !s.student_id.toLowerCase().includes(q) &&
        !s.email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  async function toggleCleared(id: string, current: boolean) {
    const { error } = await supabase
      .from("students")
      .update({ [cfg.cleared]: !current } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? ({ ...s, [cfg.cleared]: !current } as Student) : s)),
    );
    toast.success(!current ? "Marked as cleared" : "Marked as pending");
  }

  async function removeStudent(id: string) {
    if (!confirm("Remove this student from this portal?")) return;
    const { error } = await supabase
      .from("students")
      .update({ [cfg.membership]: false, [cfg.cleared]: false } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setStudents((p) => p.filter((s) => s.id !== id));
    toast.success("Removed from portal");
  }

  function beginEdit(student: Student) {
    if (!money) return;
    setEditingStudentId(student.id);
    setEditPaid(String(Number(student[money.paid] ?? 0)));
    setEditTotal(String(Number(student[money.total] ?? money.defaultTotal)));
  }

  function cancelEdit() {
    setEditingStudentId(null);
    setEditPaid("");
    setEditTotal("");
  }

  async function saveMoney(student: Student) {
    if (!money) return;
    const paid = Number(editPaid);
    const total = Number(editTotal);
    if (!Number.isFinite(paid) || !Number.isFinite(total) || paid < 0 || total < 0) {
      toast.error("Paid and total amounts must be valid non-negative numbers.");
      return;
    }

    const cleared = total > 0 && paid >= total;
    const payload: Record<string, unknown> = {
      [money.paid]: paid,
      [money.total]: total,
      [cfg.cleared]: cleared,
      [cfg.membership]: true,
    };
    const { error } = await supabase.from("students").update(payload as never).eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStudents((prev) =>
      prev.map((row) =>
        row.id === student.id
          ? ({ ...row, [money.paid]: paid, [money.total]: total, [cfg.cleared]: cleared } as Student)
          : row,
      ),
    );
    toast.success("Amounts updated.");
    cancelEdit();
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const headers = kind === "hostel"
      ? ["Student ID", "Name", "Department", "Paid", "Total"]
      : money
        ? ["Student ID", "Name", "Department", "Sem", "Year", "Paid", "Total"]
        : ["Student ID", "Name", "Department", cfg.label];
    const sample =
      kind === "fees"
        ? [
            ["24btre148", "Aarav Sharma", "Robotics", "IV", 2, 75000, 100000],
            ["24btre149", "Priya Patel", "Robotics", "IV", 2, 100000, 100000],
          ]
        : kind === "hostel"
          ? [
              ["24btre148", "Aarav Sharma", "Robotics", 30000, 50000],
              ["24btre149", "Priya Patel", "Robotics", 50000, 50000],
            ]
          : [
              ["24btre148", "Aarav Sharma", "Robotics", "Returned"],
              ["24btre149", "Priya Patel", "Robotics", "Returned"],
            ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${kind}_template.xlsx`);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (rows.length === 0) {
        toast.error("Sheet is empty. Add a header row and at least one data row.");
        return;
      }

      const sample = rows[0];
      const idKey = findColumn(sample, ROLL_ALIASES);
      const paidKey = findColumn(sample, PAID_ALIASES);
      const totalKey = findColumn(sample, TOTAL_ALIASES);
      const nameKey = findColumn(sample, ["name", "fullname", "studentname"]);
      const deptKey = findColumn(sample, ["department", "dept", "branch", "course"]);
      const semKey = findColumn(sample, ["sem", "semester"]);
      const yearKey = findColumn(sample, ["year", "yr"]);

      if (!idKey || (money && !paidKey)) {
        const missing = [!idKey ? "Student ID" : null, money && !paidKey ? "Paid" : null]
          .filter(Boolean)
          .join(", ");
        toast.error(
          `Missing required column(s): ${missing}. Detected: ${Object.keys(sample).join(", ")}`,
        );
        return;
      }

      // Build a map of roll-number -> { paid?, total?, cleared? }
      const updates = new Map<string, any>();
      let invalid = 0;
      for (const row of rows) {
        const rawId = row[idKey];
        const sid = String(rawId ?? "")
          .trim()
          .toLowerCase();
        
        if (!sid) {
          invalid++;
          continue;
        }
        
        const name = nameKey ? String(row[nameKey] ?? "").trim() : "";
        const dept = deptKey ? String(row[deptKey] ?? "").trim() : "";
        const sem = semKey ? romanToNum(String(row[semKey] ?? "")) : NaN;
        const yearNum = yearKey ? parseInt(String(row[yearKey]), 10) : NaN;

        if (money) {
          const paid = parseAmount(row[paidKey!]);
          const total = totalKey ? parseAmount(row[totalKey]) : null;
          if (paid === null) {
            invalid++;
            continue;
          }
          updates.set(sid, { paid, total, name, dept, sem, yearNum });
        } else {
          // Library case: just mark as cleared if row exists
          updates.set(sid, { cleared: true, name, dept, sem, yearNum });
        }
      }

      if (updates.size === 0) {
        toast.error("No valid rows found. Each row needs a Student ID.");
        return;
      }

      const ids = Array.from(updates.keys());
      const lookupQuery = supabase
        .from("students")
        .select("id, student_id")
        .in("student_id", ids);
      const { data: existing, error: lookupErr } = await lookupQuery;

      if (lookupErr) {
        toast.error(`Lookup failed: ${lookupErr.message}`);
        return;
      }

      type LookupRow = {
        id: string;
        student_id: string;
      } & Record<string, unknown>;

      const found = new Map<string, LookupRow>();
      for (const r of (existing ?? []) as unknown as LookupRow[]) {
        found.set(String(r.student_id).toLowerCase(), r);
      }

      let updated = 0;
      let created = 0;
      const failures: string[] = [];
      const inserts: any[] = [];

      await Promise.all(
        Array.from(updates.entries()).map(async ([sid, data]) => {
          const stu = found.get(sid);
          let finalCleared = data.cleared ?? false;
          const payload: Record<string, unknown> = {
            [cfg.membership]: true,
          };

          if (money) {
            const effectivePaid = data.paid ?? 0;
            const effectiveTotal =
              data.total !== null ? data.total : (stu ? Number(stu[money.total as string] ?? money.defaultTotal) : money.defaultTotal);
            finalCleared = effectiveTotal > 0 && effectivePaid >= effectiveTotal;
            
            payload[money.paid] = effectivePaid;
            if (data.total !== null) payload[money.total as string] = data.total;
          }

          payload[cfg.cleared] = finalCleared;

          if (!stu) {
            inserts.push({
              student_id: sid,
              email: `${sid}@gcu.edu.in`,
              full_name: data.name || sid,
              department: data.dept || "UNKNOWN",
              semester: kind === "hostel" ? 1 : (Number.isFinite(data.sem) ? data.sem : 1),
              year: kind === "hostel" ? 1 : (Number.isFinite(data.yearNum) ? data.yearNum : 1),
              fees_total: 100000,
              fees_paid: 0,
              hostel_total: 50000,
              hostel_paid: 0,
              in_library: false,
              in_hostel: false,
              in_fees: false,
              library_cleared: false,
              hostel_cleared: false,
              fees_cleared: false,
              ...payload
            });
            return;
          }

          if (data.name) payload.full_name = data.name;
          if (data.dept) payload.department = data.dept;
          if (kind !== "hostel" && Number.isFinite(data.sem)) payload.semester = data.sem;
          if (kind !== "hostel" && Number.isFinite(data.yearNum)) payload.year = data.yearNum;

          const { error: updErr } = await supabase
            .from("students")
            .update(payload as never)
            .eq("id", stu.id);

          if (updErr) failures.push(`${sid}: ${updErr.message}`);
          else updated++;
        }),
      );

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("students").insert(inserts);
        if (insErr) failures.push(`Inserts failed: ${insErr.message}`);
        else created += inserts.length;
      }

      const parts = [
        `Updated ${updated}`,
        created ? `Created ${created}` : null,
        invalid ? `${invalid} invalid` : null,
        failures.length ? `${failures.length} failed` : null,
      ].filter(Boolean);

      if (failures.length > 0) {
        toast.error(parts.join(" · "));
      } else if (updated === 0 && created === 0) {
        toast.error("No valid rows processed.");
      } else {
        toast.success(parts.join(" · "));
      }

      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read Excel file");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Bulk payment uploader (only for fees and hostel portals) */}
      <div className="card-elevated rounded-2xl p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-primary capitalize">
              Update {money?.portalLabel || "Library Clearance"} from Excel
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload Excel"}
            </button>
            <button
              onClick={() => setManualEntryOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent/80"
            >
              <Plus className="h-4 w-4" /> Add Details Manually
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleFile}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-elevated rounded-2xl p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID or email…"
                className="w-full rounded-md border border-border bg-cream pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FilterSelect
                value={dept}
                onChange={setDept}
                options={["ALL", ...depts]}
                label="Department"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt("Enter new department name:");
                if (name && name.trim()) {
                  const clean = name.trim();
                  await insertDepartment(clean);
                  const updated = await fetchDepartments();
                  setDepts(updated);
                  setDept(clean);
                  toast.success(`Department "${clean}" added.`);
                }
              }}
              className="rounded-md bg-secondary/50 p-2 text-primary hover:bg-secondary border border-border"
              title="Add new department"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {kind !== "library" && kind !== "hostel" && (
            <>
              <FilterSelect
                value={sem}
                onChange={setSem}
                options={["ALL", ...SEMESTERS.map(String)]}
                label="Semester"
              />
              <FilterSelect
                value={year}
                onChange={setYear}
                options={["ALL", ...YEARS.map(String)]}
                label="Year"
              />
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="ml-auto text-sm text-muted-foreground">
            Showing {filtered.length} / {students.length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card-elevated rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-primary">
                <tr className="text-left">
                  <th className="py-3 px-4 font-medium">Student ID</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Department</th>
                  {kind !== "library" && kind !== "hostel" && <th className="py-3 px-4 font-medium">Sem</th>}
                  {kind !== "library" && kind !== "hostel" && <th className="py-3 px-4 font-medium">Year</th>}
                  {money && <th className="py-3 px-4 font-medium text-right">Paid / Total</th>}
                  <th className="py-3 px-4 font-medium text-center">{cfg.label}</th>
                  <th className="py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cleared = Boolean(s[cfg.cleared]);
                  const paid = money ? Number(s[money.paid] ?? 0) : 0;
                  const total = money ? Number(s[money.total] ?? 0) : 0;
                  const isEditing = money && editingStudentId === s.id;
                  return (
                    <tr key={s.id} className="border-t border-border/60 hover:bg-secondary/40">
                      <td className="py-2 px-4 font-mono text-xs text-primary">{s.student_id}</td>
                      <td className="py-2 px-4 font-medium text-primary">{s.full_name}</td>
                      <td className="py-2 px-4">{s.department}</td>
                      {kind !== "library" && kind !== "hostel" && <td className="py-2 px-4">{s.semester}</td>}
                      {kind !== "library" && kind !== "hostel" && <td className="py-2 px-4">{s.year}</td>}
                      {money && (
                        <td className="py-2 px-4 text-right font-mono text-xs">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min={0}
                                value={editPaid}
                                onChange={(e) => setEditPaid(e.target.value)}
                                className="w-24 rounded border border-border bg-cream px-2 py-1 text-right text-xs"
                                aria-label={`Paid amount for ${s.student_id}`}
                              />
                              <span>/</span>
                              <input
                                type="number"
                                min={0}
                                value={editTotal}
                                onChange={(e) => setEditTotal(e.target.value)}
                                className="w-24 rounded border border-border bg-cream px-2 py-1 text-right text-xs"
                                aria-label={`Total amount for ${s.student_id}`}
                              />
                            </div>
                          ) : (
                            <>
                              ₹{paid.toLocaleString()} / ₹{total.toLocaleString()}
                            </>
                          )}
                        </td>
                      )}
                      <td className="py-2 px-4">
                        <label className="flex items-center justify-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cleared}
                            onChange={() => toggleCleared(s.id, cleared)}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          {cleared && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </label>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {money &&
                            (isEditing ? (
                              <>
                                <button
                                  onClick={() => void saveMoney(s)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                                >
                                  <Save className="h-3.5 w-3.5" /> Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                                >
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => beginEdit(s)}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                            ))}
                          {kind === "library" && (
                            <button
                              onClick={() => openBooksModal(s)}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                            >
                              <Plus className="h-3.5 w-3.5" /> Books
                            </button>
                          )}
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5 + (kind !== "library" && kind !== "hostel" ? 2 : 0) + (money ? 1 : 0)} className="py-10 text-center text-muted-foreground">
                      No students match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {manualEntryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Add Details Manually</h3>
              <button
                onClick={() => setManualEntryOpen(false)}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const sid = manualData.student_id.trim().toLowerCase();
                if (!sid) return toast.error("Student ID required");
                
                const { data: existing } = await supabase.from("students").select("id").eq("student_id", sid).maybeSingle();
                
                let finalCleared = manualData.cleared;
                const payload: Record<string, unknown> = {
                  [cfg.membership]: true,
                  full_name: manualData.full_name || sid,
                  department: manualData.department,
                  semester: manualData.semester,
                  year: manualData.year,
                };

                if (money) {
                  const paid = Number(manualData.paid) || 0;
                  const total = Number(manualData.total) || money.defaultTotal;
                  payload[money.paid] = paid;
                  payload[money.total] = total;
                  finalCleared = total > 0 && paid >= total;
                }
                payload[cfg.cleared] = finalCleared;

                if (existing) {
                  const { error } = await supabase.from("students").update(payload as never).eq("id", existing.id);
                  if (error) return toast.error(error.message);
                } else {
                  const newPayload = {
                    student_id: sid,
                    email: `${sid}@gcu.edu.in`,
                    full_name: manualData.full_name || sid,
                    department: manualData.department as any,
                    semester: manualData.semester,
                    year: manualData.year,
                    fees_total: 100000,
                    fees_paid: 0,
                    hostel_total: 50000,
                    hostel_paid: 0,
                    in_library: false,
                    in_hostel: false,
                    in_fees: false,
                    library_cleared: false,
                    hostel_cleared: false,
                    fees_cleared: false,
                    ...payload
                  };
                  const { error } = await supabase.from("students").insert(newPayload as any);
                  if (error) return toast.error(error.message);
                }
                toast.success("Student details saved.");
                setManualEntryOpen(false);
                setManualData({ student_id: "", full_name: "", department: depts[0] || "CSE", semester: 1, year: 1, paid: "", total: "", cleared: false });
                load();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Student ID</label>
                  <input required value={manualData.student_id} onChange={(e) => setManualData({...manualData, student_id: e.target.value})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-sm focus:ring-2 focus:ring-primary" placeholder="e.g. 24btre148" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name</label>
                  <input required value={manualData.full_name} onChange={(e) => setManualData({...manualData, full_name: e.target.value})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-sm focus:ring-2 focus:ring-primary" placeholder="Name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
                  <div className="flex gap-2">
                    <select value={manualData.department} onChange={(e) => setManualData({...manualData, department: e.target.value})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-base font-medium focus:ring-2 focus:ring-primary">
                      {depts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const name = window.prompt("Enter new department name:");
                        if (name && name.trim()) {
                          const clean = name.trim();
                          await insertDepartment(clean);
                          const updated = await fetchDepartments();
                          setDepts(updated);
                          setManualData((prev) => ({ ...prev, department: clean }));
                          toast.success(`Department "${clean}" added.`);
                        }
                      }}
                      className="rounded-md bg-secondary/50 px-3 py-2 text-primary hover:bg-secondary border border-border"
                      title="Add new department"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {kind !== "library" && kind !== "hostel" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Semester</label>
                      <select value={manualData.semester} onChange={(e) => setManualData({...manualData, semester: Number(e.target.value)})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-base font-medium focus:ring-2 focus:ring-primary">
                        {SEMESTERS.map(s => <option key={s} value={s}>{toRoman(s)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Year</label>
                      <select value={manualData.year} onChange={(e) => setManualData({...manualData, year: Number(e.target.value)})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-base font-medium focus:ring-2 focus:ring-primary">
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {money ? (
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Paid Amount</label>
                    <input type="number" min="0" required value={manualData.paid} onChange={(e) => setManualData({...manualData, paid: e.target.value})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-sm focus:ring-2 focus:ring-primary" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Total Amount</label>
                    <input type="number" min="0" required value={manualData.total} onChange={(e) => setManualData({...manualData, total: e.target.value})} className="w-full rounded-md border border-border bg-cream px-3 py-2 text-sm focus:ring-2 focus:ring-primary" placeholder={String(money.defaultTotal)} />
                  </div>
                </div>
              ) : (
                <div className="border-t border-border pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={manualData.cleared} onChange={(e) => setManualData({...manualData, cleared: e.target.checked})} className="h-4 w-4 accent-[var(--color-primary)]" />
                    <span className="text-sm font-medium text-primary">{cfg.label}</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setManualEntryOpen(false)} className="rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary">Cancel</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Library Books Modal */}
      {booksModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="card-elevated w-full max-w-2xl rounded-2xl p-6 flex flex-col max-h-[90vh] bg-cream shadow-2xl border border-border/80">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
              <div>
                <h3 className="text-lg font-bold text-primary">Borrowed Books Management</h3>
                <p className="text-xs text-muted-foreground">
                  {booksModalStudent.full_name} ({booksModalStudent.student_id})
                </p>
              </div>
              <button
                onClick={() => setBooksModalStudent(null)}
                className="text-muted-foreground hover:text-primary transition-colors p-1 hover:bg-secondary/40 rounded-full"
                aria-label="Close books modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add Book Form */}
            <form onSubmit={handleAddBook} className="bg-secondary/25 border border-border/80 rounded-xl p-4 mb-4 grid gap-3 sm:grid-cols-3 items-end">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-primary mb-1">Book Title *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Clean Code"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-xs text-primary shadow-sm outline-none focus:ring-1 focus:ring-primary/25"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Author Name</label>
                <input
                  type="text"
                  placeholder="e.g. Robert C. Martin"
                  value={newBookAuthor}
                  onChange={(e) => setNewBookAuthor(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-xs text-primary shadow-sm outline-none focus:ring-1 focus:ring-primary/25"
                />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-primary mb-1">Borrowed Date</label>
                  <input
                    type="date"
                    value={newBookBorrowedAt}
                    onChange={(e) => setNewBookBorrowedAt(e.target.value)}
                    className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs text-primary shadow-sm outline-none focus:ring-1 focus:ring-primary/25"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingBook}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1 shrink-0 mt-5 h-[32px] justify-center"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </form>

            {/* Books List */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Currently Borrowed Books ({modalBooks.length})
              </h4>
              
              {booksLoading ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Loading books...</p>
              ) : modalBooks.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground bg-secondary/10 rounded-lg border border-dashed border-border/80">
                  No books currently borrowed by this student.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/80">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-primary">
                      <tr className="text-left">
                        <th className="py-2 px-3 font-semibold">Title</th>
                        <th className="py-2 px-3 font-semibold">Author</th>
                        <th className="py-2 px-3 font-semibold">Borrowed Date</th>
                        <th className="py-2 px-3 font-semibold text-center">Status</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {modalBooks.map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/20">
                          <td className="py-2.5 px-3 font-medium text-primary">{b.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{b.author || "—"}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">{b.borrowed_at}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => void toggleBookReturned(b.id, b.returned)}
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                                b.returned
                                  ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/35"
                                  : "bg-accent/30 text-amber-900 border border-accent hover:bg-accent/50"
                              }`}
                            >
                              {b.returned ? "Returned" : "Pending"}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => void deleteBook(b.id)}
                              className="text-muted-foreground hover:text-primary transition-colors p-1 hover:bg-secondary/40 rounded"
                              title="Delete book"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setBooksModalStudent(null)}
                className="rounded-md border border-border bg-cream px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-cream px-3 py-2 text-base font-medium outline-none focus:ring-2 focus:ring-primary"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "ALL" ? `All ${label.toLowerCase()}` : o}
          </option>
        ))}
      </select>
    </div>
  );
}
