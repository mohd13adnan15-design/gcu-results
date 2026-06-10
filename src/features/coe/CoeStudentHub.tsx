import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { DEPARTMENTS, SEMESTERS, YEARS } from "@/lib/types";
import { fetchDepartments, insertDepartment } from "@/lib/departments-db";
import { cn } from "@/lib/utils";
import { StudentMarksAdminEditor } from "@/features/marks/StudentMarksAdminEditor";
import { propagateStudentProfileToRelatedTables } from "@/lib/student-profile-sync";
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
  Plus,
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

export function CoeStudentHub({ studentId }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [localDepts, setLocalDepts] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [inFees, setInFees] = useState(false);

  useEffect(() => {
    async function loadDepts() {
      const list = await fetchDepartments();
      setLocalDepts(list);
    }
    void loadDepts();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setStudent(null);
    } else {
      const s = data as Student;
      setStudent(s ?? null);
      if (s) {
        if (!localDepts.includes(s.department)) {
          setLocalDepts((prev) => [...prev, s.department]);
        }
        setSelectedDept(s.department);
        setInFees(s.in_fees);
      }
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
    const email = String(fd.get("email") ?? "")
      .trim()
      .toLowerCase();
    const department = String(fd.get("department") ?? "");
    if (!full_name || !email) {
      toast.error("Name and email are required.");
      return;
    }
    const patch: Record<string, unknown> = {
      full_name,
      email,
      department,
      in_fees: inFees,
    };
    const { error } = await supabase.from("students").update(patch as any).eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: propagateErr } = await propagateStudentProfileToRelatedTables(
      supabase,
      student.id,
      { full_name, email, department },
    );
    if (propagateErr) {
      toast.error(`Profile saved but sync failed: ${propagateErr}`);
      void load();
      return;
    }
    toast.success("Profile saved and updated across all portals.");
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
    if (!confirm("Reset Admin, COE, and final verification for this student?")) return;
    const { error } = await supabase
      .from("students")
      .update({
        faculty_verified: false,
        admin_verified: false,
        fully_verified: false,
        marksheet_verification_requested_at: null,
      })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification flags cleared.");
    void load();
  };

  const approveGradeCard = async () => {
    if (!student) return;
    const { error } = await supabase
      .from("students")
      .update({
        faculty_verified: true,
      })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Notify admin that COE has approved the data
    await supabase.from("portal_notifications").insert({
      recipient_portal: "admin",
      sender_portal: "head_of_coe",
      student_id: student.id,
      title: "COE Data Verified",
      message: `Grade card data for ${student.full_name} (${student.student_id}) has been verified by COE. Ready for final Admin verification.`,
    });

    toast.success("COE approved this grade card. Sent to Admin.");
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
        <p className="mt-2 text-sm text-muted-foreground">
          Check the link or pick a student from the list again.
        </p>
        <Link
          to="/coe"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" /> Back to COE
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: LucideIcon; hint: string }[] = [
    {
      id: "overview",
      label: "Profile",
      icon: User,
      hint: "",
    },
    {
      id: "fees",
      label: "Fees, hostel & library",
      icon: Wallet,
      hint: "",
    },
    {
      id: "marks",
      label: "Grade card & marks",
      icon: GraduationCap,
      hint: "",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/coe"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> COE home
          </Link>
          <h1 className="text-2xl font-bold text-primary">{student.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.email} · {student.department}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill ok={Boolean(student.fees_cleared)} label="Fees" />
            <StatusPill ok={Boolean(student.hostel_cleared)} label="Hostel" />
            <StatusPill ok={Boolean(student.library_cleared)} label="Library" />
            <StatusPill ok={Boolean(student.fully_verified)} label="Result unlocked" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void approveGradeCard()}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            Approve
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
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>
                <span className="block text-sm font-semibold text-primary">{t.label}</span>
                {t.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>}
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
              <h2 className="text-lg font-bold text-primary">Profile</h2>
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
                <div className="flex gap-2">
                  <select
                    name="department"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-cream px-3 py-2 text-base font-medium"
                  >
                    {(() => {
                      const deptMap = new Map<string, string>();
                      localDepts.forEach(d => {
                        const key = d.trim().toUpperCase();
                        if (!deptMap.has(key)) deptMap.set(key, d.trim());
                      });
                      return Array.from(deptMap.values()).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ));
                    })()}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const newDept = window.prompt("Enter new department name:");
                      if (newDept && newDept.trim()) {
                        const trimmed = newDept.trim();
                        await insertDepartment(trimmed);
                        const list = await fetchDepartments();
                        setLocalDepts(list);
                        setSelectedDept(trimmed);
                        toast.success(`Department "${trimmed}" added.`);
                      }
                    }}
                    className="mt-1 rounded-md bg-secondary/50 px-3 py-2 text-primary hover:bg-secondary border border-border"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-secondary/10 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-primary">Portal Enrollment Status</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Student enrollment is managed automatically. When a student is added to the Hostel or Library portal lists, the corresponding checkmark is done automatically and the card is unlocked in the student portal.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-3 rounded-lg border border-border/50 bg-cream/40 px-4 py-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={inFees}
                    onChange={(e) => setInFees(e.target.checked)}
                    className="h-4.5 w-4.5 accent-[var(--color-primary)] cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-primary block">Academic Fees</span>
                    <span className="text-xs text-muted-foreground block">Managed by COE</span>
                  </div>
                </label>

                <div className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm select-none",
                  student?.in_hostel 
                    ? "border-primary/20 bg-primary/5 text-primary" 
                    : "border-border/40 bg-secondary/10 text-muted-foreground/70"
                )}>
                  <input
                    type="checkbox"
                    checked={student?.in_hostel ?? false}
                    disabled
                    className="h-4.5 w-4.5 accent-[var(--color-primary)] cursor-not-allowed opacity-80"
                  />
                  <div>
                    <span className="font-semibold block">Hostel Portal</span>
                    <span className="text-xs block mt-0.5">
                      {student?.in_hostel ? (
                        <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Enrolled (Unlocked)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
                          Locked (Not Enrolled)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm select-none",
                  student?.in_library 
                    ? "border-primary/20 bg-primary/5 text-primary" 
                    : "border-border/40 bg-secondary/10 text-muted-foreground/70"
                )}>
                  <input
                    type="checkbox"
                    checked={student?.in_library ?? false}
                    disabled
                    className="h-4.5 w-4.5 accent-[var(--color-primary)] cursor-not-allowed opacity-80"
                  />
                  <div>
                    <span className="font-semibold block">Library Portal</span>
                    <span className="text-xs block mt-0.5">
                      {student?.in_library ? (
                        <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Active (Unlocked)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
                          Locked (No Activities)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
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
              All books returned
            </label>
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
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-primary/25 bg-cream p-6 shadow-sm">
            <h2 className="text-xl font-bold text-primary">Modify Gradecard</h2>
            <div className="mt-5">
              <StudentMarksAdminEditor compact prettyCard studentId={studentId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
