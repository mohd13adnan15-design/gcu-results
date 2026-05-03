import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentLayout } from "@/components/StudentLayout";
import type { Student } from "@/lib/types";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { getStudentSession } from "@/lib/auth";

export const Route = createFileRoute("/student/hostel")({
  head: () => ({ meta: [{ title: "Hostel — GCU Result Portal" }] }),
  component: () => <StudentLayout title="Hostel">{() => <HostelView />}</StudentLayout>,
});

function HostelView() {
  const [student, setStudent] = useState<Student | null>(null);
  useEffect(() => {
    const s = getStudentSession();
    if (!s) return;
    supabase
      .from("students")
      .select("*")
      .eq("id", s.id)
      .maybeSingle()
      .then(({ data }) => setStudent(data as Student | null));
  }, []);
  if (!student) return <p className="text-muted-foreground">Loading…</p>;

  if (!student.in_hostel) {
    return (
      <div className="space-y-6">
        <Link
          to="/student/dashboard"
          className="inline-flex items-center gap-2 text-primary hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="card-elevated rounded-2xl p-10 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold text-primary">Not a hostel resident</h2>
          <p className="mt-2 text-muted-foreground">
            You aren't enrolled in the hostel portal, so this clearance isn't required for you. You
            can generate your marks card directly from the dashboard.
          </p>
        </div>
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((student.hostel_paid / Math.max(1, student.hostel_total)) * 100),
  );
  const paidFull = student.hostel_cleared || pct >= 100;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="card-elevated rounded-2xl p-8 flex flex-col items-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Hostel Fees</p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary mt-1">
          ₹ {student.hostel_paid.toLocaleString()} / ₹ {student.hostel_total.toLocaleString()}
        </h2>

        <div className="relative my-6 h-[220px] w-[220px]">
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="14"
            />
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-primary">{pct}%</span>
            <span className="text-sm text-muted-foreground">paid</span>
          </div>
        </div>

        {paidFull ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" /> 100% Paid
          </span>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pending: ₹ {(student.hostel_total - student.hostel_paid).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
