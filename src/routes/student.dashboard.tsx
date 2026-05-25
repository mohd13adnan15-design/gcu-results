
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { StudentLayout } from "@/components/layout/StudentLayout";
import type { Student } from "@/lib/types";
import { IndianRupee, Home as HomeIcon, Library, CheckCircle2, Lock, FileText } from "lucide-react";
import { getStudentSession } from "@/lib/auth";
import {
  fetchLibraryPenalties,
  getOutstandingPenaltyTotal,
  resolveLibraryRemoteProfileId,
} from "@/lib/library-remote";
import {
  getFeeClearanceForCertificate,
  getMarksheetEligibility,
} from "@/lib/marksheet-verification";

export function StudentDashboardPage() {
  return <StudentLayout title="Dashboard">{() => <Dashboard />}</StudentLayout>;
}

function VerificationTimerText({ startTime }: { startTime: string }) {
  const [isAfter48Hours, setIsAfter48Hours] = useState(false);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const end = start + 48 * 60 * 60 * 1000;

    const checkTime = () => {
      const now = Date.now();
      if (now >= end) {
        setIsAfter48Hours(true);
      } else {
        setIsAfter48Hours(false);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (isAfter48Hours) {
    return <span className="text-amber-800 font-semibold">Your Grade card will be Generated Soon</span>;
  }
  return <span>Your grade card will be available within 2–3 working days</span>;
}

function Dashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLibraryPenalty, setHasLibraryPenalty] = useState(false);
  const [libraryPenaltyTotal, setLibraryPenaltyTotal] = useState(0);
  const [hasMarksheet, setHasMarksheet] = useState(false);
  const [allBooksReturned, setAllBooksReturned] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const s = getStudentSession();
    if (!s) return;
    const load = async () => {
      const [{ data }, { data: marksheetData }, { data: booksData }] = await Promise.all([
        supabase.from("students").select("*").eq("id", s.id).maybeSingle(),
        supabase.from("student_marksheets").select("id").eq("student_id", s.id).limit(1).maybeSingle(),
        supabase.from("library_books").select("returned").eq("student_id", s.id),
      ]);
      const st = data as Student | null;
      setStudent(st);
      setHasMarksheet(Boolean(marksheetData));
      const booksList = (booksData ?? []) as { returned: boolean }[];
      setAllBooksReturned(booksList.length > 0 ? booksList.every((b) => b.returned) : true);

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_marksheets",
          filter: `student_id=eq.${s.id}`,
        },
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
  const feeClearance = getFeeClearanceForCertificate({ student, hasLibraryPenalty });
  const eligibility = getMarksheetEligibility({ student, hasMarksheet, hasLibraryPenalty });
  const noDue = feeClearance.ok;
  const eligible = eligibility.eligible;
  const certificateEntryUnlocked = feeClearance.ok;
  const cardStatus = eligible
    ? "Grade Card Ready to Generate"
    : student.marksheet_verification_requested_at
      ? "Grade Card Under Verification"
      : noDue
        ? "Eligible to Start Verification"
        : "Grade Card Pending";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h2 className="text-3xl md:text-4xl font-bold text-primary">{student.full_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {student.student_id} · {student.department}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashCard
          to="/student/fees"
          icon={IndianRupee}
          label="Academic Fees"
          status={
            feesOk ? (
              <span>Paid</span>
            ) : (
              <div className="flex justify-between w-full">
                <span>Pending</span>
                <span>{Math.max(0, 100 - feesPct)}%</span>
              </div>
            )
          }
          done={feesOk}
          locked={false}
        />
        <DashCard
          to="/student/hostel"
          icon={HomeIcon}
          label="Hostel"
          status={
            !student.in_hostel ? (
              <span>Not enrolled</span>
            ) : hostelOk ? (
              <span>Paid</span>
            ) : (
              <div className="flex justify-between w-full">
                <span>Pending</span>
                <span>{Math.max(0, 100 - hostelPct)}%</span>
              </div>
            )
          }
          done={hostelOk}
          locked={!student.in_hostel}
        />
        <DashCard
          to="/student/library"
          icon={Library}
          label="Library"
          status={
            !student.in_library ? (
              <span>No Activities</span>
            ) : hasLibraryPenalty ? (
              <div className="flex justify-between w-full">
                <span>Penalty</span>
                <span>₹{libraryPenaltyTotal.toLocaleString()}</span>
              </div>
            ) : allBooksReturned || student.library_cleared ? (
              <span>No penalties</span>
            ) : (
              <span>Pending</span>
            )
          }
          done={libraryOk}
          locked={!student.in_library}
        />
      </section>

      {student.marks_uploaded_at && !student.marksheet_verification_requested_at && (
        <section className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-sm font-semibold text-primary flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Your Grades are uploaded, you can press the Generate Gradecard button below.
          </p>
        </section>
      )}

      {student.marksheet_verification_requested_at && !eligible && (
         <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <VerificationTimerText startTime={student.marksheet_verification_requested_at} />
          </p>
        </section>
      )}

      <section className="card-elevated rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              <FileText className="h-5 w-5" /> Grade card
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {eligible
                ? "Your Grade Card passed all checks - Tap Download Certificate."
                : certificateEntryUnlocked
                  ? "All required clearances are completed. You can now track its status."
                  : "Clear academic, hostel (if applicable), and library dues (including penalties) to continue."}
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
            </ul>
          </div>
          <button
            onClick={() =>
              navigate("/student/certificate-flow", {
                state: { autoStartCertificate: !eligible },
              })
            }
            disabled={!certificateEntryUnlocked}
            className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {eligible ? "Download certificate" : student.marksheet_verification_requested_at ? "View Verification Status" : "Generate Grade card"}
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
  footer,
}: {
  to: string;
  icon: typeof IndianRupee;
  label: string;
  status: React.ReactNode;
  done: boolean;
  locked: boolean;
  footer?: React.ReactNode;
}) {
  const inner = (
    <div
      className={`card-elevated rounded-2xl p-6 h-full transition flex flex-col justify-between hover:-translate-y-0.5 ${locked ? "opacity-60" : ""}`}
    >
      <div>
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
        <div className="mt-1 text-sm text-muted-foreground">{status}</div>
      </div>
      {footer && (
        <div className="mt-4 text-xs text-muted-foreground border-t border-border/40 pt-2 text-left">
          {footer}
        </div>
      )}
    </div>
  );
  if (locked) return <div className="cursor-not-allowed">{inner}</div>;
  return <Link to={to}>{inner}</Link>;
}
