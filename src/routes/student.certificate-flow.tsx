import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { supabase } from "@/integrations/supabase/client";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { getStudentSession } from "@/lib/auth";
import {
  fetchLibraryPenalties,
  getOutstandingPenaltyTotal,
  resolveLibraryRemoteProfileId,
} from "@/lib/library-remote";
import { fetchStudentMarksheet, type StudentMarksheet } from "@/lib/marksheet";
import {
  getFeeClearanceForCertificate,
  getMarksheetEligibility,
  missingReasonLabel,
  studentRequestedMarksheetVerification,
} from "@/lib/marksheet-verification";
import type { Student } from "@/lib/types";

type LocationState = { autoStartCertificate?: boolean } | null;

export function StudentCertificateFlowPage() {
  return (
    <StudentLayout title="Certificate" tagline="YOUR HARD WORK, RECOGNIZED. THE FINAL STEP TOWARD YOUR BRIGHT FUTURE STARTS HERE.">
      {() => <CertificateFlow />}
    </StudentLayout>
  );
}

function CertificateFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const clearRouteState = useCallback(() => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {},
    });
  }, [location.hash, location.pathname, location.search, navigate]);
  const autoStartHandledRef = useRef(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [marksheetError, setMarksheetError] = useState<string | null>(null);
  const [hasLibraryPenalty, setHasLibraryPenalty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    const session = getStudentSession();
    if (!session) return;
    setLoading(true);
    const { data } = await supabase.from("students").select("*").eq("id", session.id).maybeSingle();
    const st = (data as Student | null) ?? null;
    setStudent(st);
    if (!st) {
      setLoading(false);
      return;
    }

    let nextHasLibraryPenalty = false;
    if (st.in_library && isLibraryRemoteConfigured()) {
      const profileId = resolveLibraryRemoteProfileId(st);
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

    try {
      setMarksheetError(null);
      setMarksheet(await fetchStudentMarksheet(supabase, st.id));
    } catch (error) {
      setMarksheet(null);
      setMarksheetError(error instanceof Error ? error.message : "Could not load marksheet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) return;

    const channel = supabase
      .channel(`student-cert-flow:${session.id}`)
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
      supabase.removeChannel(channel);
    };
  }, [load]);

  const feeClearance = useMemo(
    () => (student ? getFeeClearanceForCertificate({ student, hasLibraryPenalty }) : null),
    [student, hasLibraryPenalty],
  );

  const eligibility = useMemo(
    () =>
      student
        ? getMarksheetEligibility({
            student,
            hasMarksheet: Boolean(marksheet),
            hasLibraryPenalty,
          })
        : null,
    [student, marksheet, hasLibraryPenalty],
  );

  const hasRequest = student ? studentRequestedMarksheetVerification(student) : false;

  const startCertificateProcess = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!student || !feeClearance?.ok) {
        if (!opts?.silent) {
          toast.error("Clear academic, hostel (if applicable), and library dues first.");
        }
        return false;
      }
      if (hasRequest) {
        if (!opts?.silent) {
          toast.message("Your certificate process is already running - watch the steps below.");
        }
        return true;
      }

      setActionBusy(true);
      try {
        const requestedAt = new Date().toISOString();
        const { error } = await supabase
          .from("students")
          .update({
            marksheet_verification_requested_at: requestedAt,
            /* Auto-verify faculty since COE uploaded the data, going directly to Admin */
            faculty_verified: true,
            admin_verified: false,
            fully_verified: false,
          })
          .eq("id", student.id);
        if (error) throw error;

        await supabase.from("portal_notifications").insert({
          recipient_portal: "admin_1",
          sender_portal: "fees",
          student_id: student.id,
          title: "Student requested grade card verification",
          message: `${student.student_id} (${student.full_name}) started the certificate process. Review under Verification 1.`,
        });

        if (!opts?.silent) {
          toast.success("Your Grade Card Under Verification");
        }
        await load();
        return true;
      } catch (error) {
        if (!opts?.silent) {
          toast.error(error instanceof Error ? error.message : "Could not start process");
        }
        return false;
      } finally {
        setActionBusy(false);
      }
    },
    [student, feeClearance?.ok, hasRequest, load],
  );

  /** One press from dashboard: auto-queue faculty when fees are clear (no second button). */
  useEffect(() => {
    const state = location.state as LocationState;
    if (!state?.autoStartCertificate || autoStartHandledRef.current) return;
    if (loading || !student) return;

    autoStartHandledRef.current = true;

    if (!feeClearance?.ok) {
      clearRouteState();
      return;
    }
    if (hasRequest) {
      clearRouteState();
      return;
    }

    void (async () => {
      const ok = await startCertificateProcess({ silent: true });
      if (ok) {
        toast.success("Your Grade card will be generated in 48 hours.");
      }
      clearRouteState();
    })();
  }, [
    clearRouteState,
    loading,
    student,
    feeClearance?.ok,
    hasRequest,
    location.state,
    startCertificateProcess,
  ]);

  if (loading || !student) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const feesOk = Boolean(feeClearance?.ok);
  const dataOk = Boolean(marksheet);
  /** Only show faculty/admin as done after the student has started this pipeline (avoids legacy DB flags). */
  const facultyOk = Boolean(student.faculty_verified && hasRequest);
  const adminOk = Boolean(student.admin_verified && hasRequest);
  const pdfOk = Boolean(eligibility?.eligible);

  const flowNodes: {
    key: string;
    title: string;
    short: string;
    ok: boolean;
    pendingHint?: string;
  }[] = [
    {
      key: "fees",
      title: "Fees",
      short: "Academic · hostel · library",
      ok: feesOk,
      pendingHint: !feesOk ? "Pay dues first" : undefined,
    },
    {
      key: "verification",
      title: "Verification",
      short: "Internal review & approval",
      ok: adminOk,
      pendingHint:
        feesOk && hasRequest && !adminOk
          ? "Within shared 48h window"
          : !hasRequest
            ? "After you start"
            : undefined,
    },
    {
      key: "pdf",
      title: "Certificate",
      short: "Download PDF",
      ok: pdfOk,
      pendingHint: !pdfOk ? "After verification approves" : undefined,
    },
  ];

  const showGenerateButton = feesOk && !pdfOk;

  return (
    <div className="space-y-8">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Single primary action */}
      <section className="flex flex-col gap-4 rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-cream to-white p-6 md:p-8">
        {!feesOk && (
          <p className="text-sm text-amber-900">
            Clear all required fees and library penalties from the dashboard portals before you can
            start.
          </p>
        )}

        {showGenerateButton && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-primary">
                {hasRequest ? "Process running" : "Ready to start"}
              </p>
              <p className="text-sm text-muted-foreground">
                  {hasRequest
                    ? "Internal verification is in progress. This page updates automatically."
                    : "One tap submits your file for verification - no separate request step."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startCertificateProcess()}
              disabled={actionBusy || hasRequest}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy ? "Starting…" : hasRequest ? "Process started" : "Generate certificate"}
            </button>
          </div>
        )}

        {pdfOk && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-emerald-900">
              ✨ Verification complete! Your secure grade card is ready for download.
            </p>
            <button
              type="button"
              onClick={() => navigate("/student/marks-card")}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:opacity-90"
            >
              Download certificate
            </button>
          </div>
        )}
      </section>

      {hasRequest && !pdfOk && student?.marksheet_verification_requested_at && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CountdownTimer requestedAtStr={student.marksheet_verification_requested_at} />
        </section>
      )}


      {/* Flow diagram */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">How your certificate moves forward</h3>
        <FlowDiagram nodes={flowNodes} />
      </section>


    </div>
  );
}

function FlowDiagram({
  nodes,
}: {
  nodes: {
    key: string;
    title: string;
    short: string;
    ok: boolean;
    pendingHint?: string;
  }[];
}) {
  return (
    <>
      {/* Mobile: vertical */}
      <div className="flex flex-col gap-0 md:hidden">
        {nodes.map((node, index) => (
          <div key={node.key}>
            <FlowNode {...node} step={index + 1} />
            {index < nodes.length - 1 && (
              <div className="flex justify-center py-1 text-primary/70" aria-hidden>
                <ArrowDown className="h-6 w-6" strokeWidth={2} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: horizontal pipeline with arrows */}
      <div className="hidden md:block overflow-x-auto pb-2">
        <div className="flex min-w-[640px] flex-row items-stretch justify-between gap-1 lg:min-w-0 lg:gap-2">
          {nodes.map((node, index) => (
            <div key={node.key} className="flex min-w-0 flex-1 items-center gap-1">
              <div className="min-w-0 flex-1">
                <FlowNode {...node} step={index + 1} />
              </div>
              {index < nodes.length - 1 && (
                <div
                  className="flex shrink-0 items-center justify-center px-0.5 text-primary/70"
                  aria-hidden
                >
                  <ArrowRight className="h-7 w-7" strokeWidth={2} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CountdownTimer({ requestedAtStr }: { requestedAtStr: string }) {
  return <span className="font-medium text-amber-800">Your Grade Card Under Verification</span>;
}

function FlowNode({
  step,
  title,
  short,
  ok,
  pendingHint,
}: {
  step: number;
  title: string;
  short: string;
  ok: boolean;
  pendingHint?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border-2 p-3 text-center shadow-sm transition-colors ${
        ok ? "border-emerald-500/70 bg-emerald-50/90" : "border-border bg-card"
      }`}
    >
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {step}
        </span>
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        ) : (
          <CircleDot className="h-5 w-5 text-rose-500/90" aria-hidden />
        )}
      </div>
      <p className="text-sm font-bold leading-tight text-primary">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{short}</p>
      {pendingHint && !ok && (
        <p className="mt-2 text-[11px] leading-snug text-amber-800">{pendingHint}</p>
      )}
    </div>
  );
}

