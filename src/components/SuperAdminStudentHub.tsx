import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { DEPARTMENTS, SEMESTERS, YEARS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StudentMarksAdminEditor } from "@/components/StudentMarksAdminEditor";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BadgeCheck,
  BookMarked,
  GraduationCap,
  IndianRupee,
  Loader2,
  User,
  Wallet,
} from "lucide-react";

type TabId = "overview" | "fees" | "marks";

type Props = {
  studentId: string;
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        ok ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {ok ? <BadgeCheck className="h-3.5 w-3.5" /> : null}
      {label}: {ok ? "Yes" : "No"}
    </span>
  );
}

export function SuperAdminStudentHub({ studentId }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
    if (error) {
      toast.error(error.message);
      setStudent(null);
    } else {
      setStudent((data as Student) ?? null);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!student) return;
    const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get("full_name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const passwordRaw = String(fd.get("password") ?? "").trim();
    const department = String(fd.get("department") ?? "");
    const semester = Number(fd.get("semester") ?? 1);
    const year = Number(fd.get("year") ?? 1);
    if (!full_name || !email) {
      toast.error("Name and email are required.");
      return;
    }
    const patch: Record<string, unknown> = {
      full_name,
      email,
      department,
      semester: Number.isFinite(semester) ? semester : student.semester,
      year: Number.isFinite(year) ? year : student.year,
      in_fees: fd.get("in_fees") === "on",
      in_hostel: fd.get("in_hostel") === "on",
      in_library: fd.get("in_library") === "on",
    };
    if (passwordRaw) patch.password = passwordRaw;

    const { error } = await supabase.from("students").update(patch).eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved.");
    const pw = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[name="password"]');
    if (pw) pw.value = "";
    void load();
  };

  const saveFeesHostelLibrary = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!student) return;
    const fd = new FormData(e.currentTarget);
    const fees_paid = Number(fd.get("fees_paid") ?? 0);
    const fees_total = Number(fd.get("fees_total") ?? 0);
    const hostel_paid = Number(fd.get("hostel_paid") ?? 0);
    const hostel_total = Number(fd.get("hostel_total") ?? 0);
    const library_remote = String(fd.get("library_remote_profile_id") ?? "").trim();

    const { error } = await supabase
      .from("students")
      .update({
        fees_paid: Number.isFinite(fees_paid) ? fees_paid : 0,
        fees_total: Number.isFinite(fees_total) ? fees_total : 0,
        hostel_paid: Number.isFinite(hostel_paid) ? hostel_paid : 0,
        hostel_total: Number.isFinite(hostel_total) ? hostel_total : 0,
        fees_cleared: fd.get("fees_cleared") === "on",
        hostel_cleared: fd.get("hostel_cleared") === "on",
        library_cleared: fd.get("library_cleared") === "on",
        library_remote_profile_id: library_remote || null,
      })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fees, hostel, and library status saved.");
    void load();
  };

  const clearVerification = async () => {
    if (!student) return;
    if (!confirm("Reset faculty, admin, and final verification for this student?")) return;
    const { error } = await supabase
      .from("students")
      .update({ faculty_verified: false, admin_verified: false, fully_verified: false })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification flags cleared.");
    void load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="card-elevated rounded-2xl p-8 text-center">
        <p className="text-primary font-medium">Student not found</p>
        <p className="mt-2 text-sm text-muted-foreground">Check the link or pick a student from the list again.</p>
        <Link
          to="/super-admin"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Super Admin
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: LucideIcon; hint: string }[] = [
    {
      id: "overview",
      label: "Profile & access",
      icon: User,
      hint: "Identity, portal membership, verification",
    },
    {
      id: "fees",
      label: "Fees, hostel & library",
      icon: Wallet,
      hint: "Amounts and clearance flags",
    },
    {
      id: "marks",
      label: "Grade card & marks",
      icon: GraduationCap,
      hint: "Header, subjects, sync to marksheet",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/super-admin"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> Super Admin home
          </Link>
          <h1 className="text-2xl font-bold text-primary">{student.full_name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{student.student_id}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.email} · {student.department} · Semester {student.semester} · Year {student.year}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill ok={Boolean(student.fees_cleared)} label="Fees" />
            <StatusPill ok={Boolean(student.hostel_cleared)} label="Hostel" />
            <StatusPill ok={Boolean(student.library_cleared)} label="Library" />
            <StatusPill ok={Boolean(student.fully_verified)} label="Result unlocked" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-border bg-cream/60 p-4 text-sm">
          <p className="font-medium text-primary">Verification pipeline</p>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={Boolean(student.faculty_verified)} label="Faculty" />
            <StatusPill ok={Boolean(student.admin_verified)} label="Admin" />
            <StatusPill ok={Boolean(student.fully_verified)} label="Final" />
          </div>
          <button
            type="button"
            onClick={() => void clearVerification()}
            className="mt-1 text-left text-xs text-destructive underline-offset-2 hover:underline"
          >
            Reset all verification flags
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Student record sections"
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors sm:min-w-[200px] sm:flex-initial",
                active
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-cream/40 hover:bg-secondary/50",
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-semibold text-primary">{t.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => void saveProfile(e)}
            className="card-elevated space-y-6 rounded-2xl p-6"
          >
            <div>
              <h2 className="text-lg font-bold text-primary">Profile & portal membership</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update the student record used across all portals. Check which areas this student belongs to
                (fees, hostel, library lists).
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Full name</label>
                <input
                  name="full_name"
                  required
                  defaultValue={student.full_name}
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={student.email}
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <select
                  name="department"
                  defaultValue={student.department}
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">New password (optional)</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Semester</label>
                <select
                  name="semester"
                  defaultValue={student.semester}
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                >
                  {SEMESTERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Year</label>
                <select
                  name="year"
                  defaultValue={student.year}
                  className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/20 p-4">
              <p className="text-sm font-medium text-primary">Include in portal lists</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Each portal only sees students when the corresponding box is checked.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="in_fees"
                    defaultChecked={student.in_fees}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Academic fees
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="in_hostel"
                    defaultChecked={student.in_hostel}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Hostel
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="in_library"
                    defaultChecked={student.in_library}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Library
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Save profile
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "fees" && (
        <form
          onSubmit={(e) => void saveFeesHostelLibrary(e)}
          className="card-elevated space-y-6 rounded-2xl p-6"
        >
          <div>
            <h2 className="text-lg font-bold text-primary">Fees, hostel & library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Match the numbers used on the dedicated fees and hostel portals. Check the box when clearance is
              granted.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 font-semibold text-primary">
                <IndianRupee className="h-4 w-4" /> Academic fees
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Paid (₹)</label>
                  <input
                    name="fees_paid"
                    type="number"
                    min={0}
                    defaultValue={student.fees_paid}
                    className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total (₹)</label>
                  <input
                    name="fees_total"
                    type="number"
                    min={0}
                    defaultValue={student.fees_total}
                    className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="fees_cleared"
                  defaultChecked={student.fees_cleared}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Academic fees cleared
              </label>
            </div>

            <div className="space-y-4 rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 font-semibold text-primary">
                <Wallet className="h-4 w-4" /> Hostel
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Paid (₹)</label>
                  <input
                    name="hostel_paid"
                    type="number"
                    min={0}
                    defaultValue={student.hostel_paid}
                    className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total (₹)</label>
                  <input
                    name="hostel_total"
                    type="number"
                    min={0}
                    defaultValue={student.hostel_total}
                    className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="hostel_cleared"
                  defaultChecked={student.hostel_cleared}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Hostel charges cleared
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold text-primary">
              <BookMarked className="h-4 w-4" /> Library
            </h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="library_cleared"
                defaultChecked={student.library_cleared}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              All books returned / library cleared
            </label>
            <div>
              <label className="text-sm font-medium">Library profile ID (optional)</label>
              <p className="text-xs text-muted-foreground">External library system profile UUID, if you use sync.</p>
              <input
                name="library_remote_profile_id"
                defaultValue={student.library_remote_profile_id ?? ""}
                className="mt-1 w-full max-w-lg rounded-md border border-border bg-cream px-3 py-2 font-mono text-sm"
                placeholder="UUID or leave empty"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Save fees, hostel & library
            </button>
          </div>
        </form>
      )}

      {tab === "marks" && (
        <div className="rounded-2xl border-2 border-primary/25 bg-cream p-6 shadow-sm">
          <h2 className="text-xl font-bold text-primary">Marksheet — edit in place</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Everything below is editable: header lines, each course row, then{" "}
            <strong className="text-foreground">Save</strong> on a row or{" "}
            <strong className="text-foreground">Save header &amp; sync</strong> to push grades and SGPA into the saved
            marksheet (<code className="rounded bg-muted px-1 py-0.5 text-xs">student_marksheets</code>) for Admin and
            students.
          </p>
          <div className="mt-5">
            <StudentMarksAdminEditor compact prettyCard studentId={studentId} />
          </div>
        </div>
      )}
    </div>
  );
}
