import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { DEPARTMENTS, SEMESTERS, YEARS } from "@/lib/types";
import { toast } from "sonner";
import { Trash2, Search, CheckCircle2, Upload, Download } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (sem !== "ALL" && s.semester !== Number(sem)) return false;
    if (year !== "ALL" && s.year !== Number(year)) return false;
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

  function downloadTemplate() {
    if (!money) return;
    const wb = XLSX.utils.book_new();
    const headers = ["Roll No", "Name", "Paid", "Total"];
    const sample =
      kind === "fees"
        ? [
            ["24btre148", "Aarav Sharma", 75000, 100000],
            ["24btre149", "Priya Patel", 100000, 100000],
            ["24btre150", "Rohit Kumar", 50000, 100000],
          ]
        : [
            ["24btre148", "Aarav Sharma", 30000, 50000],
            ["24btre149", "Priya Patel", 50000, 50000],
            ["24btre150", "Rohit Kumar", 25000, 50000],
          ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `${kind}_payments_template.xlsx`);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !money) return;
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

      if (!idKey || !paidKey) {
        const missing = [!idKey ? "Roll No (Student ID)" : null, !paidKey ? "Paid (Amount)" : null]
          .filter(Boolean)
          .join(", ");
        toast.error(
          `Missing required column(s): ${missing}. Detected: ${Object.keys(sample).join(", ")}`,
        );
        return;
      }

      // Build a map of roll-number -> { paid, total? }, deduping in case the
      // same roll appears twice in the sheet (last value wins — simplest UX).
      const updates = new Map<string, { paid: number; total: number | null }>();
      let invalid = 0;
      for (const row of rows) {
        const rawId = row[idKey];
        const sid = String(rawId ?? "")
          .trim()
          .toLowerCase();
        const paid = parseAmount(row[paidKey]);
        const total = totalKey ? parseAmount(row[totalKey]) : null;
        if (!sid || paid === null) {
          invalid++;
          continue;
        }
        updates.set(sid, { paid, total });
      }

      if (updates.size === 0) {
        toast.error("No valid rows found. Each row needs a roll number and a numeric paid amount.");
        return;
      }

      const ids = Array.from(updates.keys());
      // Supabase's typed client requires a literal column list, so we pick
      // the right select per portal instead of building it dynamically.
      const lookupQuery =
        kind === "fees"
          ? supabase
              .from("students")
              .select("id, student_id, fees_paid, fees_total")
              .in("student_id", ids)
          : supabase
              .from("students")
              .select("id, student_id, hostel_paid, hostel_total")
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
      let notFound = 0;
      const failures: string[] = [];

      // Run updates in parallel — Supabase handles ~100 concurrent calls fine
      // and bulk uploads are typically 50–200 rows in a real registrar's office.
      await Promise.all(
        Array.from(updates.entries()).map(async ([sid, { paid, total }]) => {
          const stu = found.get(sid);
          if (!stu) {
            notFound++;
            return;
          }
          // Decide effective total: explicit value in the sheet wins; otherwise
          // keep whatever total is already set on the student row.
          const effectiveTotal =
            total !== null ? total : Number(stu[money.total as string] ?? money.defaultTotal);
          const cleared = effectiveTotal > 0 && paid >= effectiveTotal;

          const payload: Record<string, unknown> = {
            [money.paid]: paid,
            [cfg.cleared]: cleared,
            [cfg.membership]: true,
          };
          if (total !== null) payload[money.total as string] = total;

          const { error: updErr } = await supabase
            .from("students")
            .update(payload as never)
            .eq("id", stu.id);

          if (updErr) failures.push(`${sid}: ${updErr.message}`);
          else updated++;
        }),
      );

      const parts = [
        `Updated ${updated} student${updated === 1 ? "" : "s"}`,
        notFound ? `${notFound} roll${notFound === 1 ? "" : "s"} not found` : null,
        invalid ? `${invalid} invalid row${invalid === 1 ? "" : "s"}` : null,
        failures.length ? `${failures.length} failed` : null,
      ].filter(Boolean);

      if (failures.length > 0) {
        toast.error(parts.join(" · "));
        console.error("Failed updates:", failures);
      } else if (updated === 0) {
        toast.error(parts.join(" · "));
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
      {money && (
        <div className="card-elevated rounded-2xl p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary">
                Bulk update {money.portalLabel} from Excel
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload a sheet of <strong>Roll No</strong> + <strong>Paid</strong> (and optional{" "}
                <strong>Total</strong>). Order doesn't matter — students are matched by roll number,
                payments overwrite each time. Cleared flag is set automatically when paid ≥ total.
              </p>
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
      )}

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
          <FilterSelect
            value={dept}
            onChange={setDept}
            options={["ALL", ...DEPARTMENTS]}
            label="Department"
          />
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
                  <th className="py-3 px-4 font-medium">Sem</th>
                  <th className="py-3 px-4 font-medium">Year</th>
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
                  return (
                    <tr key={s.id} className="border-t border-border/60 hover:bg-secondary/40">
                      <td className="py-2 px-4 font-mono text-xs text-primary">{s.student_id}</td>
                      <td className="py-2 px-4 font-medium text-primary">{s.full_name}</td>
                      <td className="py-2 px-4">{s.department}</td>
                      <td className="py-2 px-4">{s.semester}</td>
                      <td className="py-2 px-4">{s.year}</td>
                      {money && (
                        <td className="py-2 px-4 text-right font-mono text-xs">
                          ₹{paid.toLocaleString()} / ₹{total.toLocaleString()}
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
                        <button
                          onClick={() => removeStudent(s.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={money ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      No students match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
        className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "ALL" ? `All ${label.toLowerCase()}` : `${label}: ${o}`}
          </option>
        ))}
      </select>
    </div>
  );
}
