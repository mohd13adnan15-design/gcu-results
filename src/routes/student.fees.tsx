import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentLayout } from "@/components/StudentLayout";
import type { Student } from "@/lib/types";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { getStudentSession } from "@/lib/auth";

export const Route = createFileRoute("/student/fees")({
  head: () => ({ meta: [{ title: "Academic Fees — GCU Result Portal" }] }),
  component: () => <StudentLayout title="Academic Fees">{() => <FeesView />}</StudentLayout>,
});

function FeesView() {
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

  const pct = Math.min(
    100,
    Math.round((student.fees_paid / Math.max(1, student.fees_total)) * 100),
  );
  const pending = Math.max(0, student.fees_total - student.fees_paid);
  const paidFull = student.fees_cleared || pct >= 100;

  return (
    <div className="space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="card-elevated rounded-2xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">Academic Fees</p>
            <h2 className="text-3xl font-bold text-primary">
              ₹ {student.fees_paid.toLocaleString()} / ₹ {student.fees_total.toLocaleString()}
            </h2>
          </div>
          {paidFull ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
              <CheckCircle2 className="h-4 w-4" /> 100% Paid
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-primary">
              <AlertCircle className="h-4 w-4" /> Pending ₹ {pending.toLocaleString()}
            </span>
          )}
        </div>

        {/* Linear progress bar */}
        <div className="mt-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>0%</span>
            <span className="font-bold text-primary">{pct}% paid</span>
            <span>100%</span>
          </div>
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-secondary border border-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {!paidFull && (
          <div className="mt-6 rounded-xl border border-border bg-secondary p-4 text-sm text-primary">
            <strong>Reminder:</strong> Please complete the remaining ₹{pending.toLocaleString()} to
            obtain fees clearance and unlock your marks card.
          </div>
        )}
      </div>
    </div>
  );
}
