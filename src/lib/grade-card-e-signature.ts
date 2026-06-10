import type { SupabaseClient } from "@supabase/supabase-js";

import type { PortalType } from "@/lib/types";

export const GRADE_CARD_E_SIGNATURE_BUCKET = "student-photos";

export type GradeCardSignatureRole = "checked_by" | "verified_by";

export type GradeCardESignatureStatus = "draft" | "approved";

export type GradeCardESignatureRow = {
  id: string;
  student_id: string;
  signature_role: GradeCardSignatureRole;
  admin_id: string;
  signature_url: string;
  status: GradeCardESignatureStatus;
  signed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BackPageSignatureUrls = {
  checkedByUrl: string | null;
  verifiedByUrl: string | null;
  isApproved: boolean;
};

type SignatureEntry = {
  admin_id: string;
  signature_url: string;
  status: GradeCardESignatureStatus;
  signed_at: string;
  approved_at: string | null;
};

type SignatureMetaStore = Partial<Record<GradeCardSignatureRole, SignatureEntry>>;

const SIGNING_PORTALS: PortalType[] = ["admin", "head_of_coe"];

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("grade_card_e_signatures") ||
    message.includes("does not exist")
  );
}

export function formatSignatureError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    if (isMissingTableError(error as { code?: string; message?: string })) {
      return "Signature storage is not fully configured. Using local fallback — run the Supabase migration for full persistence.";
    }
    return message;
  }
  return "Could not save signature.";
}

function localMetaKey(studentId: string) {
  return `gcu-grade-card-e-signatures:${studentId}`;
}

function readLocalMeta(studentId: string): SignatureMetaStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(localMetaKey(studentId));
    return raw ? (JSON.parse(raw) as SignatureMetaStore) : {};
  } catch {
    return {};
  }
}

function writeLocalMeta(studentId: string, meta: SignatureMetaStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localMetaKey(studentId), JSON.stringify(meta));
}

function entryToRow(studentId: string, role: GradeCardSignatureRole, entry: SignatureEntry): GradeCardESignatureRow {
  const now = entry.signed_at || new Date().toISOString();
  return {
    id: `${studentId}-${role}`,
    student_id: studentId,
    signature_role: role,
    admin_id: entry.admin_id,
    signature_url: entry.signature_url,
    status: entry.status,
    signed_at: entry.signed_at,
    approved_at: entry.approved_at,
    created_at: now,
    updated_at: now,
  };
}

function metaToRows(studentId: string, meta: SignatureMetaStore): GradeCardESignatureRow[] {
  const rows: GradeCardESignatureRow[] = [];
  for (const role of ["checked_by", "verified_by"] as const) {
    const entry = meta[role];
    if (entry?.signature_url) rows.push(entryToRow(studentId, role, entry));
  }
  return rows;
}

async function fetchDbSignatures(
  supabase: SupabaseClient,
  studentId: string,
): Promise<GradeCardESignatureRow[] | null> {
  const { data, error } = await supabase
    .from("grade_card_e_signatures")
    .select("*")
    .eq("student_id", studentId);

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }

  return (data as GradeCardESignatureRow[]) ?? [];
}

async function persistMetaEntry(
  supabase: SupabaseClient,
  studentId: string,
  role: GradeCardSignatureRole,
  entry: SignatureEntry,
): Promise<GradeCardESignatureRow> {
  const meta = readLocalMeta(studentId);
  meta[role] = entry;
  writeLocalMeta(studentId, meta);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("grade_card_e_signatures")
    .upsert(
      {
        student_id: studentId,
        signature_role: role,
        admin_id: entry.admin_id,
        signature_url: entry.signature_url,
        status: entry.status,
        signed_at: entry.signed_at,
        approved_at: entry.approved_at,
        updated_at: now,
      },
      { onConflict: "student_id,signature_role" },
    )
    .select("*")
    .single();

  if (error && !isMissingTableError(error)) throw error;
  if (data) return data as GradeCardESignatureRow;
  return entryToRow(studentId, role, entry);
}

export function canSignGradeCard(portal: PortalType | null | undefined): boolean {
  return Boolean(portal && SIGNING_PORTALS.includes(portal));
}

export function signatureRoleLabel(role: GradeCardSignatureRole): string {
  return role === "checked_by" ? "Checked by" : "Verified by";
}

export function buildSignatureStoragePath(
  studentId: string,
  role: GradeCardSignatureRole,
  ext = "png",
): string {
  const safeExt = ext.replace(/^\./, "");
  return `esign-${studentId}-${role}.${safeExt}`;
}

export function signaturePublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  return supabase.storage.from(GRADE_CARD_E_SIGNATURE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export async function fetchGradeCardESignatures(
  supabase: SupabaseClient,
  studentId: string,
): Promise<GradeCardESignatureRow[]> {
  const dbRows = await fetchDbSignatures(supabase, studentId);
  if (dbRows && dbRows.length > 0) return dbRows;

  const localRows = metaToRows(studentId, readLocalMeta(studentId));
  if (localRows.length > 0) return localRows;

  return dbRows ?? [];
}

export async function fetchApprovedBackPageSignatures(
  supabase: SupabaseClient,
  studentId: string,
): Promise<BackPageSignatureUrls> {
  const rows = await fetchGradeCardESignatures(supabase, studentId);
  const approved = rows.filter((row) => row.status === "approved");

  const checked = approved.find((row) => row.signature_role === "checked_by");
  const verified = approved.find((row) => row.signature_role === "verified_by");

  return {
    checkedByUrl: checked ? signaturePublicUrl(supabase, checked.signature_url) : null,
    verifiedByUrl: verified ? signaturePublicUrl(supabase, verified.signature_url) : null,
    isApproved: Boolean(verified),
  };
}

export async function uploadSignatureBlob(
  supabase: SupabaseClient,
  studentId: string,
  role: GradeCardSignatureRole,
  blob: Blob,
): Promise<string> {
  const ext = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : "png";
  const path = buildSignatureStoragePath(studentId, role, ext);
  const contentType = ext === "jpg" ? "image/jpeg" : "image/png";
  const typedBlob =
    blob.type === contentType ? blob : new Blob([await blob.arrayBuffer()], { type: contentType });

  const { error } = await supabase.storage
    .from(GRADE_CARD_E_SIGNATURE_BUCKET)
    .upload(path, typedBlob, { upsert: true, contentType });

  if (error) {
    throw new Error(error.message || "Failed to upload signature image to storage.");
  }
  return path;
}

export async function saveDraftSignature(
  supabase: SupabaseClient,
  params: {
    studentId: string;
    adminId: string;
    role: GradeCardSignatureRole;
    storagePath: string;
  },
): Promise<GradeCardESignatureRow> {
  const now = new Date().toISOString();
  const entry: SignatureEntry = {
    admin_id: params.adminId,
    signature_url: params.storagePath,
    status: "draft",
    signed_at: now,
    approved_at: null,
  };
  return persistMetaEntry(supabase, params.studentId, params.role, entry);
}

export async function approveStudentSignatures(
  supabase: SupabaseClient,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const meta = readLocalMeta(studentId);
  for (const role of ["checked_by", "verified_by"] as const) {
    if (meta[role]?.signature_url && meta[role]?.status === "draft") {
      meta[role] = { ...meta[role]!, status: "approved", approved_at: now, signed_at: now };
    }
  }
  writeLocalMeta(studentId, meta);

  const { error } = await supabase
    .from("grade_card_e_signatures")
    .update({
      status: "approved",
      approved_at: now,
      signed_at: now,
      updated_at: now,
    })
    .eq("student_id", studentId)
    .eq("status", "draft");

  if (error && !isMissingTableError(error)) throw error;
}

export async function revokeSignatureApproval(
  supabase: SupabaseClient,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const meta = readLocalMeta(studentId);
  for (const role of ["checked_by", "verified_by"] as const) {
    if (meta[role]?.status === "approved") {
      meta[role] = { ...meta[role]!, status: "draft", approved_at: null };
    }
  }
  writeLocalMeta(studentId, meta);

  const { error } = await supabase
    .from("grade_card_e_signatures")
    .update({
      status: "draft",
      approved_at: null,
      updated_at: now,
    })
    .eq("student_id", studentId)
    .eq("status", "approved");

  if (error && !isMissingTableError(error)) throw error;
}

export function hasApprovedVerifiedSignature(rows: GradeCardESignatureRow[]): boolean {
  return rows.some((row) => row.signature_role === "verified_by" && row.status === "approved");
}

export function isSignatureLocked(rows: GradeCardESignatureRow[]): boolean {
  return rows.some((row) => row.status === "approved");
}

export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a > 0 && (r < 250 || g < 250 || b < 250)) return false;
  }
  return true;
}
