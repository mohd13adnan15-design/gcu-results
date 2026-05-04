import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { StudentLayout } from "@/components/StudentLayout";
import { getStudentSession } from "@/lib/auth";
import {
  fetchLibraryPenalties,
  getOutstandingPenaltyTotal,
  resolveLibraryRemoteProfileId,
} from "@/lib/library-remote";
import type { Student } from "@/lib/types";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchStudentMarksheet,
  resolveStudentPhotoUrl,
  type StudentMarksheet,
} from "@/lib/marksheet";
import { getMarksheetEligibility, missingReasonLabel } from "@/lib/marksheet-verification";

export const Route = createFileRoute("/student/marks-card")({
  head: () => ({ meta: [{ title: "Marksheet — GCU Result Portal" }] }),
  component: () => <StudentLayout title="Marksheet">{() => <MarksCard />}</StudentLayout>,
});

function MarksCard() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [marksheetError, setMarksheetError] = useState<string | null>(null);
  const [hasLibraryPenalty, setHasLibraryPenalty] = useState(false);
  const [verified, setVerified] = useState(false);
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<"pdf" | null>(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) return;

    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      const nextStudent = (data as Student | null) ?? null;
      if (!active) return;

      setStudent(nextStudent);
      if (!nextStudent) return;

      let nextMarksheet: StudentMarksheet | null = null;
      try {
        setMarksheetError(null);
        nextMarksheet = await fetchStudentMarksheet(supabase, nextStudent.id);
        setMarksheet(nextMarksheet);
      } catch (error) {
        setMarksheet(null);
        setMarksheetError(error instanceof Error ? error.message : "Could not load marksheet data");
      }

      let nextHasLibraryPenalty = false;

      if (nextStudent.in_library && isLibraryRemoteConfigured()) {
        const profileId = resolveLibraryRemoteProfileId(nextStudent);
        if (profileId) {
          try {
            const rows = await fetchLibraryPenalties(profileId);
            nextHasLibraryPenalty = getOutstandingPenaltyTotal(rows) > 0;
          } catch {
            nextHasLibraryPenalty = false;
          }
        }
      }
      setHasLibraryPenalty(nextHasLibraryPenalty);

      const eligibility = getMarksheetEligibility({
        student: nextStudent,
        hasMarksheet: Boolean(nextMarksheet),
        hasLibraryPenalty: nextHasLibraryPenalty,
      });

      if (!eligibility.eligible) {
        toast.error(
          nextHasLibraryPenalty
            ? "Outstanding library penalty. Please clear dues first."
            : eligibility.missing.map(missingReasonLabel).join(", "),
        );
        navigate({ to: "/student/dashboard" });
      }
    };

    void load();

    const channel = supabase
      .channel(`student-marks:${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `id=eq.${session.id}` },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_marksheets",
          filter: `student_id=eq.${session.id}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  async function sendOtp() {
    if (!student) return;
    const eligibility = getMarksheetEligibility({
      student,
      hasMarksheet: Boolean(marksheet),
      hasLibraryPenalty,
    });
    if (!eligibility.eligible) {
      toast.error(eligibility.missing.map(missingReasonLabel).join(", "));
      navigate({ to: "/student/dashboard" });
      return;
    }

    setBusy(true);
    try {
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: dbErr } = await supabase
        .from("email_otps")
        .insert({ email: student.email, otp: otpCode, expires_at: expiresAt });
      if (dbErr) throw new Error(dbErr.message);

      setSentOtp(otpCode);
      setStage("sent");
      toast.success(`OTP sent to ${student.email}`);
      toast.message(`Demo OTP: ${otpCode}`, { duration: 10000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!student || otp.length !== 6) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from("email_otps")
        .select("*")
        .eq("email", student.email)
        .eq("otp", otp.trim())
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        toast.error("Invalid or expired OTP");
        return;
      }

      await supabase
        .from("email_otps")
        .update({ used: true } as never)
        .eq("id", (data as { id: string }).id);

      setVerified(true);
      toast.success("Verified ✓");
    } finally {
      setBusy(false);
    }
  }

  async function downloadMarksheet() {
    if (!marksheet) {
      toast.error("No marksheet data is saved for this student yet.");
      return;
    }
    if (!student) return;
    const eligibility = getMarksheetEligibility({
      student,
      hasMarksheet: true,
      hasLibraryPenalty,
    });
    if (!eligibility.eligible) {
      toast.error(eligibility.missing.map(missingReasonLabel).join(", "));
      navigate({ to: "/student/dashboard" });
      return;
    }

    setDownloadBusy("pdf");
    try {
      const [{ downloadMarksheetBlob, generateMarksheetPdf }, photoUrl] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, marksheet),
      ]);
      const blob = await generateMarksheetPdf(marksheet, { photoUrl });
      downloadMarksheetBlob(marksheet, "pdf", blob);
      toast.success("PDF marksheet generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate marksheet");
    } finally {
      setDownloadBusy(null);
    }
  }

  if (!student) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {!verified ? (
        <div className="card-elevated mx-auto max-w-xl rounded-2xl p-8">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="h-6 w-6" />
            <h2 className="text-2xl font-bold">Verify it's you</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll send a 6-digit code to <strong>{student.email}</strong>. Enter it below to unlock
            your official marksheet downloads.
          </p>

          {stage === "idle" ? (
            <button
              onClick={sendOtp}
              disabled={busy}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Mail className="h-4 w-4" /> {busy ? "Sending…" : "Send OTP"}
            </button>
          ) : (
            <div className="mt-6 space-y-3">
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                inputMode="numeric"
                className="w-full rounded-md border border-border bg-cream px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={verifyOtp}
                  disabled={busy || otp.length !== 6}
                  className="flex-1 rounded-md bg-primary py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button
                  onClick={sendOtp}
                  disabled={busy}
                  className="rounded-md border border-border bg-cream px-4 py-2.5 text-primary hover:bg-secondary"
                >
                  Resend
                </button>
              </div>
              {sentOtp && (
                <p className="text-center text-xs text-muted-foreground">
                  Demo mode — OTP is also shown above. In production this is sent only to your
                  email.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card-elevated mx-auto max-w-3xl rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-3">
              <div>
                <h2 className="text-2xl font-bold text-primary">Official Marksheet Download</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate your locked PDF marksheet with your saved student details, course rows,
                  credits, grades, SGPA, and final grade.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-foreground">
                <p className="font-semibold text-primary">Saved marksheet data</p>
                {marksheet ? (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    <p>
                      Student: <strong>{marksheet.student_name}</strong>
                    </p>
                    <p>
                      Roll no: <strong>{marksheet.student_roll_no}</strong>
                    </p>
                    <p>
                      Registration: <strong>{marksheet.registration_no}</strong>
                    </p>
                    <p>
                      Programme: <strong>{marksheet.programme_code}</strong>
                    </p>
                    <p>
                      Courses: <strong>{marksheet.courses.length}</strong>
                    </p>
                    <p>
                      SGPA: <strong>{marksheet.sgpa.toFixed(2)}</strong>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2">
                    No marksheet row is saved yet for <strong>{student.student_id}</strong>.
                    {marksheetError ? ` ${marksheetError}` : ""}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void downloadMarksheet()}
                  disabled={!marksheet || Boolean(downloadBusy)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" />
                  {downloadBusy === "pdf" ? "Generating PDF..." : "Download PDF"}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Files are generated from <code>student_marksheets</code>, not the blank template.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
