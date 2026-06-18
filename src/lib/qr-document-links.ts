/** Document kinds encoded in printed QR codes. */
export type QrDocumentKind = "grade" | "marks" | "degree";

const KIND_PATH: Record<QrDocumentKind, string> = {
  grade: "grade",
  marks: "marks",
  degree: "degree",
};

const DOWNLOAD_PATH: Record<QrDocumentKind, string> = {
  grade: "/gradecard/download",
  marks: "/markscard/download",
  degree: "/degree/download",
};

function resolveOrigin(origin?: string): string {
  if (origin?.trim()) return origin.trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://example.com";
}

function normalizeRegistrationNo(value: string): string {
  return String(value ?? "").trim();
}

/** Registration number is the only student-specific QR payload. */
export function buildDocumentQrTarget(
  kind: QrDocumentKind,
  registrationNo: string,
  origin?: string,
): string {
  const reg = encodeURIComponent(normalizeRegistrationNo(registrationNo));
  const base = resolveOrigin(origin);
  return `${base}/scan/${KIND_PATH[kind]}/${reg}`;
}

export function getDocumentDownloadPath(
  kind: QrDocumentKind,
  registrationNo: string,
): string {
  const reg = encodeURIComponent(normalizeRegistrationNo(registrationNo));
  return `${DOWNLOAD_PATH[kind]}?reg=${reg}`;
}

export function parseQrScanKind(value: string | undefined): QrDocumentKind | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "grade" || normalized === "gr") return "grade";
  if (normalized === "marks" || normalized === "mc") return "marks";
  if (normalized === "degree" || normalized === "dc") return "degree";
  return null;
}

export async function buildDocumentQrDataUrl(
  kind: QrDocumentKind,
  registrationNo: string,
  options?: {
    origin?: string;
    width?: number;
    light?: string;
    dark?: string;
  },
): Promise<string | null> {
  const QRCode = await import("qrcode");
  try {
    return await QRCode.toDataURL(buildDocumentQrTarget(kind, registrationNo, options?.origin), {
      errorCorrectionLevel: "M",
      margin: 1,
      color: {
        dark: options?.dark ?? "#1a1a1a",
        light: options?.light ?? "#f6f1e4",
      },
      width: options?.width ?? 180,
    });
  } catch {
    return null;
  }
}
