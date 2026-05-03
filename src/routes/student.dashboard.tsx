import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { StudentLayout } from "@/components/StudentLayout";
import type { Student } from "@/lib/types";
import { IndianRupee, Home as HomeIcon, Library, CheckCircle2, Lock, FileText } from "lucide-react";
import { getStudentSession } from "@/lib/auth";
import {
  fetchLibraryPenalties,
  getOutstandingPenaltyTotal,
  resolveLibraryRemoteProfileId,
} from "@/lib/library-remote";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GCU Result Portal" }] }),
  component: StudentDashboardPage,
});

function StudentDashboardPage() {
  return <StudentLayout title="Dashboard">{() => <Dashboard />}</StudentLayout>;
}

function Dashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLibraryPenalty, setHasLibraryPenalty] = useState(false);
  const [libraryPenaltyTotal, setLibraryPenaltyTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const s = getStudentSession();
    if (!s) return;
    const load = async () => {
      const { data } = await supabase.from("students").select("*").eq("id", s.id).maybeSingle();
      const st = data as Student | null;
      setStudent(st);

      if (!st?.in_library || !isLibraryRemoteConfigured()) {
        setHasLibraryPenalty(false);
        setLibraryPenaltyTotal(0);
        setLoading(false);
        return;
      }

      const profileId = resolveLibraryRemoteProfileId(st);
      if (!profileId) {
        setHasLibraryPenalty(false);
        setLibraryPenaltyTotal(0);
        setLoading(false);
        return;
      }

      try {
        const rows = await fetchLibraryPenalties(profileId);
        const total = getOutstandingPenaltyTotal(rows);
        setHasLibraryPenalty(total > 0);
        setLibraryPenaltyTotal(total);
      } catch {
        // If remote fetch fails, don't falsely block issuance.
        setHasLibraryPenalty(false);
        setLibraryPenaltyTotal(0);
      } finally {
        setLoading(false);
      }
    };
    load();
    const channel = supabase
      .channel(`student-dashboard:${s.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `id=eq.${s.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !student) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const feesPct = Math.round((student.fees_paid / Math.max(1, student.fees_total)) * 100);
  const hostelPct = student.in_hostel
    ? Math.round((student.hostel_paid / Math.max(1, student.hostel_total)) * 100)
    : 0;

  const feesOk = student.fees_cleared;
  const hostelOk = !student.in_hostel || student.hostel_cleared;
  const libraryOk = !student.in_library || (student.library_cleared && !hasLibraryPenalty);
  const noDue = feesOk && hostelOk && libraryOk;
  const facultyOk = Boolean(student.faculty_verified);
  const adminOk = Boolean(student.admin_verified);
  const eligible = noDue && facultyOk && adminOk;
  const cardStatus = eligible
    ? "Grade Card Ready to Generate"
    : noDue
      ? "Grade Card Under Verification"
      : "Grade Card Pending";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h2 className="text-3xl md:text-4xl font-bold text-primary">{student.full_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {student.student_id} · {student.department} · Sem {student.semester} · Year {student.year}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashCard
          to="/student/fees"
          icon={IndianRupee}
          label="Academic Fees"
          status={feesOk ? "Paid" : `${feesPct}%`}
          done={feesOk}
          locked={false}
        />
        <DashCard
          to="/student/hostel"
          icon={HomeIcon}
          label="Hostel"
          status={!student.in_hostel ? "Not enrolled" : hostelOk ? "Paid" : `${hostelPct}%`}
          done={hostelOk}
          locked={!student.in_hostel}
        />
        <DashCard
          to="/student/library"
          icon={Library}
          label="Library"
          status={!student.in_library ? "Not enrolled" : libraryOk ? "All returned" : "Pending"}
          done={libraryOk}
          locked={!student.in_library}
        />
      </section>

      <section className="card-elevated rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              <FileText className="h-5 w-5" /> Marks card
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {eligible
                ? "Your Grade Card is ready to generate."
                : "Verification of Grade Card is under process."}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="flex items-center gap-2">
                {feesOk ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                Academic fees clearance
              </li>
              <li className="flex items-center gap-2">
                {hostelOk ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                Hostel clearance {!student.in_hostel && "(not required)"}
              </li>
              <li className="flex items-center gap-2">
                {libraryOk ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                Library clearance {!student.in_library && "(not required)"}
              </li>
              {student.in_library && hasLibraryPenalty && (
                <li className="text-xs text-amber-800">
                  Outstanding library penalty: ₹{libraryPenaltyTotal.toLocaleString()}
                </li>
              )}
              <li className="text-xs text-muted-foreground">Status: {cardStatus}</li>
              <li className="text-xs text-muted-foreground">
                {eligible ? "Unlocked" : "Locked"} for generation
              </li>
            </ul>
          </div>
          <button
            onClick={() => navigate({ to: "/student/marks-card" })}
            disabled={!eligible}
            className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generate certificate
          </button>
        </div>
      </section>
    </div>
  );
}

function DashCard({
  to,
  icon: Icon,
  label,
  status,
  done,
  locked,
}: {
  to: string;
  icon: typeof IndianRupee;
  label: string;
  status: string;
  done: boolean;
  locked: boolean;
}) {
  const inner = (
    <div
      className={`card-elevated rounded-2xl p-6 h-full transition hover:-translate-y-0.5 ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-accent ${locked ? "locked-blur" : ""}`}
        >
          <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        {locked ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : done ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : null}
      </div>
      <p className="mt-6 text-2xl font-bold text-primary">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{status}</p>
    </div>
  );
  if (locked) return <div className="cursor-not-allowed">{inner}</div>;
  return <Link to={to}>{inner}</Link>;
}
