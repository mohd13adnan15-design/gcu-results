import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eraser, Loader2, Lock, PenLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  approveStudentSignatures,
  canSignGradeCard,
  fetchGradeCardESignatures,
  formatSignatureError,
  hasApprovedVerifiedSignature,
  isCanvasBlank,
  isSignatureLocked,
  revokeSignatureApproval,
  saveDraftSignature,
  signaturePublicUrl,
  signatureRoleLabel,
  uploadSignatureBlob,
  type GradeCardESignatureRow,
  type GradeCardSignatureRole,
} from "@/lib/grade-card-e-signature";
import { normalizePortalType } from "@/lib/portal";
import type { PortalType } from "@/lib/types";

type Props = {
  studentId: string;
  portal?: PortalType | null;
  adminId?: string | null;
  darkTheme?: boolean;
  onApprovalChange?: () => void;
};

export function useAdminSigningContext() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const { data: profile } = await supabase
        .from("portal_profiles")
        .select("portal")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setAdminId(session.user.id);
      setPortal(normalizePortalType(profile?.portal ? String(profile.portal) : null));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { adminId, portal };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function SignatureCanvas({
  role,
  locked,
  previewUrl,
  onSave,
  busy,
}: {
  role: GradeCardSignatureRole;
  locked: boolean;
  previewUrl: string | null;
  onSave: (blob: Blob) => Promise<void>;
  busy: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setLocalPreview(null);
  }, []);

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas, role]);

  useEffect(() => {
    if (previewUrl) setLocalPreview(previewUrl);
  }, [previewUrl]);

  function getPoint(event: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(event: React.MouseEvent | React.TouchEvent) {
    if (locked) return;
    event.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(event: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current || locked) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(event);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  async function saveCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isCanvasBlank(canvas)) {
      toast.error("Draw a signature or upload an image before saving.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setLocalPreview(dataUrl);
    await onSave(dataUrlToBlob(dataUrl));
  }

  async function handleUpload(file: File) {
    if (locked) return;
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      toast.error("Upload a PNG or JPG signature image.");
      return;
    }
    const dataUrl = URL.createObjectURL(file);
    setLocalPreview(dataUrl);
    await onSave(file);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {signatureRoleLabel(role)}
      </p>
      <div className="relative rounded-lg border border-border bg-white overflow-hidden">
        {localPreview && locked ? (
          <img src={localPreview} alt={signatureRoleLabel(role)} className="h-28 w-full object-contain p-2" />
        ) : (
          <canvas
            ref={canvasRef}
            width={420}
            height={112}
            className={`h-28 w-full touch-none ${locked ? "opacity-60 pointer-events-none" : "cursor-crosshair"}`}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        )}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/5">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveCanvas()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary disabled:opacity-50"
          >
            <PenLine className="h-3.5 w-3.5" /> Save draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearCanvas}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary disabled:opacity-50"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-cream px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function GradeCardESignaturePanel({
  studentId,
  portal: portalProp,
  adminId: adminIdProp,
  darkTheme = false,
  onApprovalChange,
}: Props) {
  const session = useAdminSigningContext();
  const adminId = adminIdProp ?? session.adminId;
  const portal = portalProp ?? session.portal;
  const [rows, setRows] = useState<GradeCardESignatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canSign = canSignGradeCard(portal) && Boolean(adminId);
  const locked = isSignatureLocked(rows);
  const approved = hasApprovedVerifiedSignature(rows);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGradeCardESignatures(supabase, studentId);
      setRows(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load e-signatures.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function rowFor(role: GradeCardSignatureRole) {
    return rows.find((row) => row.signature_role === role) ?? null;
  }

  function previewFor(role: GradeCardSignatureRole): string | null {
    const row = rowFor(role);
    if (!row?.signature_url) return null;
    return signaturePublicUrl(supabase, row.signature_url);
  }

  async function saveRole(role: GradeCardSignatureRole, blob: Blob) {
    if (!adminId || !canSign) {
      toast.error("Only Admin or COE staff can add e-signatures.");
      return;
    }
    if (locked) {
      toast.error("Signatures are locked. Revoke approval to edit.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadSignatureBlob(supabase, studentId, role, blob);
      await saveDraftSignature(supabase, {
        studentId,
        adminId,
        role,
        storagePath: path,
      });
      toast.success(`${signatureRoleLabel(role)} saved as draft.`);
      await load();
      onApprovalChange?.();
    } catch (error) {
      toast.error(formatSignatureError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!canSign) return;
    const hasVerifiedDraft = rows.some(
      (row) => row.signature_role === "verified_by" && row.status === "draft" && row.signature_url,
    );
    const hasVerifiedApproved = rows.some(
      (row) => row.signature_role === "verified_by" && row.status === "approved",
    );
    if (!hasVerifiedDraft && !hasVerifiedApproved) {
      toast.error("Add and save a Verified by signature before approval.");
      return;
    }
    setBusy(true);
    try {
      await approveStudentSignatures(supabase, studentId);
      toast.success("E-signatures approved. You can now generate the final PDF.");
      await load();
      onApprovalChange?.();
    } catch (error) {
      toast.error(formatSignatureError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!canSign) return;
    if (!confirm("Revoke signature approval? You will need to re-approve before generating a new final PDF.")) {
      return;
    }
    setBusy(true);
    try {
      await revokeSignatureApproval(supabase, studentId);
      toast.success("Approval revoked. Signatures are editable again.");
      await load();
      onApprovalChange?.();
    } catch (error) {
      toast.error(formatSignatureError(error));
    } finally {
      setBusy(false);
    }
  }

  const shell = darkTheme
    ? "rounded-xl border border-slate-700 bg-slate-900/80 p-4"
    : "rounded-xl border border-primary/20 bg-cream/40 p-4";

  if (!canSign) {
    return (
      <div className={shell}>
        <p className="text-sm text-muted-foreground">
          E-signature approval is restricted to Admin and COE roles.
        </p>
        {approved && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Back-page signatures approved
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold ${darkTheme ? "text-white" : "text-primary"}`}>
            Add E-Signature
          </h3>
          <p className={`mt-1 text-xs ${darkTheme ? "text-slate-400" : "text-muted-foreground"}`}>
            Draw or upload signatures for the grade card back page. Approve before generating the final PDF.
          </p>
        </div>
        {approved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading signatures…
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SignatureCanvas
              role="checked_by"
              locked={locked}
              previewUrl={previewFor("checked_by")}
              onSave={(blob) => saveRole("checked_by", blob)}
              busy={busy}
            />
            <SignatureCanvas
              role="verified_by"
              locked={locked}
              previewUrl={previewFor("verified_by")}
              onSave={(blob) => saveRole("verified_by", blob)}
              busy={busy}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!locked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleApprove()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve E-Signatures
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRevoke()}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"
              >
                Revoke approval &amp; re-sign
              </button>
            )}
          </div>

          {!approved && (
            <p className="mt-3 text-xs text-amber-700">
              Final PDF generation requires an approved Verified by signature.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function useGradeCardSignatureApproved(studentId: string) {
  const [approved, setApproved] = useState(false);
  const [signatureUrls, setSignatureUrls] = useState<{
    checkedByUrl: string | null;
    verifiedByUrl: string | null;
  }>({ checkedByUrl: null, verifiedByUrl: null });
  const [previewUrls, setPreviewUrls] = useState<{
    checkedByUrl: string | null;
    verifiedByUrl: string | null;
  }>({ checkedByUrl: null, verifiedByUrl: null });

  const refresh = useCallback(async () => {
    const rows = await fetchGradeCardESignatures(supabase, studentId);
    setApproved(hasApprovedVerifiedSignature(rows));
    const approvedRows = rows.filter((row) => row.status === "approved");
    const previewRows = rows.filter((row) => row.signature_url);
    setSignatureUrls({
      checkedByUrl: approvedRows.find((row) => row.signature_role === "checked_by")
        ? signaturePublicUrl(
            supabase,
            approvedRows.find((row) => row.signature_role === "checked_by")!.signature_url,
          )
        : null,
      verifiedByUrl: approvedRows.find((row) => row.signature_role === "verified_by")
        ? signaturePublicUrl(
            supabase,
            approvedRows.find((row) => row.signature_role === "verified_by")!.signature_url,
          )
        : null,
    });
    setPreviewUrls({
      checkedByUrl: previewRows.find((row) => row.signature_role === "checked_by")
        ? signaturePublicUrl(
            supabase,
            previewRows.find((row) => row.signature_role === "checked_by")!.signature_url,
          )
        : null,
      verifiedByUrl: previewRows.find((row) => row.signature_role === "verified_by")
        ? signaturePublicUrl(
            supabase,
            previewRows.find((row) => row.signature_role === "verified_by")!.signature_url,
          )
        : null,
    });
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setApproved(false);
      setSignatureUrls({ checkedByUrl: null, verifiedByUrl: null });
      setPreviewUrls({ checkedByUrl: null, verifiedByUrl: null });
      return;
    }
    void refresh();
  }, [refresh, studentId]);

  return { approved, signatureUrls, previewUrls, refresh };
}
