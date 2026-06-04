import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { getStudentSession } from "@/lib/auth";
import {
  fetchLibraryPenalties,
  getOutstandingPenaltyTotal,
  resolveLibraryRemoteProfileId,
} from "@/lib/library-remote";
import type { Student } from "@/lib/types";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { supabase } from "@/integrations/supabase/client";
import { subscribePostgresChanges } from "@/lib/supabase-realtime";
import {
  fetchStudentMarksheet,
  fetchAllStudentMarksheets,
  resolveStudentPhotoUrl,
  type StudentMarksheet,
} from "@/lib/marksheet";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import { getMarksheetEligibility, missingReasonLabel } from "@/lib/marksheet-verification";

const OTP_SESSION_KEY = "gcu-student-marks-otp-verified";

function hasOtpSession(studentId: string) {
  try {
    return sessionStorage.getItem(`${OTP_SESSION_KEY}:${studentId}`) === "1";
  } catch {
    return false;
  }
}

function setOtpSession(studentId: string) {
  try {
    sessionStorage.setItem(`${OTP_SESSION_KEY}:${studentId}`, "1");
  } catch {
    // ignore storage failures
  }
}

export function StudentMarksCardPage() {
  return (
    <StudentLayout title="Grade & Marks Cards" showQueriesFooter>
      {() => <MarksCard />}
    </StudentLayout>
  );
}

function MarksCard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [allMarksheets, setAllMarksheets] = useState<StudentMarksheet[]>([]);
  const [marksheetError, setMarksheetError] = useState<string | null>(null);
  const [hasLibraryPenalty, setHasLibraryPenalty] = useState(false);
  const [verified, setVerified] = useState(false);
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [showSemesterSelection, setShowSemesterSelection] = useState(false);
  const [showMarksCardSelection, setShowMarksCardSelection] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

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
      if (!nextStudent) {
        setPageLoading(false);
        return;
      }

      let nextMarksheet: StudentMarksheet | null = null;
      let nextAllMarksheets: StudentMarksheet[] = [];
      try {
        setMarksheetError(null);
        nextMarksheet = await fetchStudentMarksheet(supabase, nextStudent.id);
        nextAllMarksheets = await fetchAllStudentMarksheets(supabase, nextStudent.id);
        setMarksheet(nextMarksheet);
        setAllMarksheets(nextAllMarksheets);
      } catch (error) {
        setMarksheet(null);
        setAllMarksheets([]);
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
      setPageLoading(false);
    };

    void load();

    const unsubscribe = subscribePostgresChanges(
      `student-marks:${session.id}`,
      [
        { event: "*", schema: "public", table: "students", filter: `id=eq.${session.id}` },
        {
          event: "*",
          schema: "public",
          table: "student_marksheets",
          filter: `student_id=eq.${session.id}`,
        },
      ],
      () => {
        void load();
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const eligibility = useMemo(
    () =>
      student
        ? getMarksheetEligibility({
          student,
          hasMarksheet: allMarksheets.length > 0 || Boolean(marksheet),
          hasLibraryPenalty,
        })
        : null,
    [student, marksheet, allMarksheets.length, hasLibraryPenalty],
  );

  const canDownloadWithoutOtp = Boolean(eligibility?.eligible && student?.fully_verified);
  const showDownloadPanel = canDownloadWithoutOtp || verified;

  useEffect(() => {
    if (!student?.id) return;
    if (canDownloadWithoutOtp || hasOtpSession(student.id)) {
      setVerified(true);
    }
  }, [canDownloadWithoutOtp, student?.id]);

  async function sendOtp() {
    if (!student) return;
    const eligibility = getMarksheetEligibility({
      student,
      hasMarksheet: Boolean(marksheet),
      hasLibraryPenalty,
    });
    if (!eligibility.eligible) {
      toast.error(eligibility.missing.map(missingReasonLabel).join(", "));
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
      setOtpSession(student.id);
      toast.success("Verified ✓");
    } finally {
      setBusy(false);
    }
  }

  async function downloadMarksheet(targetMarksheet: StudentMarksheet) {
    if (!targetMarksheet) {
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
      return;
    }

    setDownloadBusy(targetMarksheet.id ?? "current");
    try {
      const [{ downloadMarksheetBlob, generateMarksheetPdf }, photoUrl, backSigs] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, targetMarksheet),
        fetchApprovedBackPageSignatures(supabase, student.id),
      ]);
      const blob = await generateMarksheetPdf(targetMarksheet, {
        photoUrl,
        allMarksheets,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadMarksheetBlob(targetMarksheet, "pdf", blob);
      toast.success("PDF marksheet generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate marksheet");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadAllSemesters() {
    if (allMarksheets.length === 0) {
      toast.error("No marksheet data found for this student.");
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
      return;
    }

    setDownloadBusy("all");
    try {
      const [{ downloadBlob, generateAllSemestersPdf }, photoUrl, backSigs] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, marksheet || allMarksheets[0]),
        fetchApprovedBackPageSignatures(supabase, student.id),
      ]);
      const blob = await generateAllSemestersPdf(allMarksheets, {
        photoUrl,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      // Build file name similar to single marksheet but with AllSemesters
      const studentSlug = (marksheet || allMarksheets[0]).student_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const rollNo = (marksheet || allMarksheets[0]).student_roll_no.toLowerCase();
      downloadBlob(blob, `GradeCard_AllSemesters.pdf`);
      toast.success("PDF with all semesters generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate all semesters PDF");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadMarksCard(targetMarksheet: StudentMarksheet) {
    if (!targetMarksheet?.courses?.length) {
      toast.error("No marks card data is saved for this student yet.");
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
      return;
    }

    setDownloadBusy(`marks-${targetMarksheet.id ?? "current"}`);
    try {
      const [documents, photoUrl] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, targetMarksheet),
      ]);
      const blob = await documents.generateMarksCardPdf(targetMarksheet, { photoUrl });
      documents.downloadMarksCardBlob(targetMarksheet, blob);
      toast.success("Marks card PDF generated");
    } catch (error) {
      console.error("Marks card PDF generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not generate marks card");
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadAllMarksCards() {
    if (allMarksheets.length === 0) {
      toast.error("No marks card data found for this student.");
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
      return;
    }

    setDownloadBusy("marks-all");
    try {
      const [documents, photoUrl] = await Promise.all([
        import("@/lib/marksheet-documents"),
        resolveStudentPhotoUrl(supabase, marksheet || allMarksheets[0]),
      ]);
      const blob = await documents.generateAllMarksCardsPdf(allMarksheets, { photoUrl });
      documents.downloadAllMarksCardsBlob(blob, (marksheet || allMarksheets[0]).student_roll_no);
      toast.success("Marks card PDF with all semesters generated");
    } catch (error) {
      console.error("All marks cards PDF generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not generate marks cards");
    } finally {
      setDownloadBusy(null);
    }
  }

  if (pageLoading || !student) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="space-y-6">
        <Link
          to="/student/certificate-flow"
          className="inline-flex items-center gap-2 text-primary hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" /> Back to certificate flow
        </Link>
        <div className="card-elevated mx-auto max-w-lg rounded-2xl p-8">
          <h2 className="text-xl font-bold text-primary">Download not available yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete fee clearance, submit your verification request, and wait for COE and Admin
            approval. You can track progress on the certificate flow page.
          </p>
          <p className="mt-4 text-sm font-medium text-amber-900">
            Pending: {eligibility.missing.map(missingReasonLabel).join(", ")}
          </p>
          <Link
            to="/student/certificate-flow"
            className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Open certificate flow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {!showDownloadPanel ? (
        <div className="card-elevated mx-auto max-w-xl rounded-2xl p-8">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="h-6 w-6" />
            <h2 className="text-2xl font-bold">Verify it's you</h2>
          </div>

          {stage === "idle" ? (
            <div className="mt-6 flex justify-center">
              <button
                onClick={sendOtp}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Mail className="h-4 w-4" /> {busy ? "Sending…" : "Send OTP"}
              </button>
            </div>
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
                <h2 className="text-2xl font-bold text-primary">Download Grade & Marks Cards</h2>
              </div>
              <div className="flex flex-col gap-4 pt-2">
                <h3 className="font-bold text-primary">Download Grade Cards</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSemesterSelection(!showSemesterSelection);
                        if (!showSemesterSelection) setShowMarksCardSelection(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      <FileText className="h-4 w-4" />
                      Download Semester Wise
                    </button>
                    {allMarksheets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void downloadAllSemesters()}
                        disabled={Boolean(downloadBusy)}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 text-primary hover:bg-muted disabled:opacity-60"
                      >
                        <FileText className="h-4 w-4" />
                        {downloadBusy === "all" ? "Generating..." : "Download All Semesters"}
                      </button>
                    )}
                  </div>
                  {showSemesterSelection && allMarksheets.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="mb-1 w-full text-sm font-medium text-primary">Select Semester:</p>
                      {allMarksheets.map((m) => {
                        const semName = (m.semester_label || "").toLowerCase().startsWith("sem")
                          ? m.semester_label
                          : `Sem ${m.semester_label}`;
                        return (
                          <button
                            key={m.id || m.semester_label}
                            type="button"
                            onClick={() => void downloadMarksheet(m)}
                            disabled={Boolean(downloadBusy)}
                            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                          >
                            <FileText className="h-4 w-4" />
                            {downloadBusy === (m.id ?? "current") ? "Generating..." : semName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <h3 className="pt-4 font-bold text-primary">Download Marks Cards</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMarksCardSelection(!showMarksCardSelection);
                        if (!showMarksCardSelection) setShowSemesterSelection(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 text-primary hover:bg-muted disabled:opacity-60"
                    >
                      <FileText className="h-4 w-4" />
                      Marks Card
                    </button>
                    {allMarksheets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void downloadAllMarksCards()}
                        disabled={Boolean(downloadBusy)}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 text-primary hover:bg-muted disabled:opacity-60"
                      >
                        <FileText className="h-4 w-4" />
                        {downloadBusy === "marks-all" ? "Generating..." : "All Semesters Marks Card"}
                      </button>
                    )}
                  </div>
                  {showMarksCardSelection && allMarksheets.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="mb-1 w-full text-sm font-medium text-primary">Select Semester:</p>
                      {allMarksheets.map((m) => {
                        const semName = (m.semester_label || "").toLowerCase().startsWith("sem")
                          ? m.semester_label
                          : `Sem ${m.semester_label}`;
                        const busyKey = `marks-${m.id ?? "current"}`;
                        return (
                          <button
                            key={`marks-${m.id || m.semester_label}`}
                            type="button"
                            onClick={() => void downloadMarksCard(m)}
                            disabled={Boolean(downloadBusy)}
                            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                          >
                            <FileText className="h-4 w-4" />
                            {downloadBusy === busyKey ? "Generating..." : semName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
