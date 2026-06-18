import { Navigate, useParams } from "react-router-dom";

import {
  getDocumentDownloadPath,
  parseQrScanKind,
} from "@/lib/qr-document-links";

/** QR scan entry — resolves identifier to the correct public download page. */
export function QrScanResolverPage() {
  const { kind, reg } = useParams<{ kind: string; reg: string }>();
  const documentKind = parseQrScanKind(kind);
  const registrationNo = decodeURIComponent(reg ?? "").trim();

  if (!documentKind || !registrationNo) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={getDocumentDownloadPath(documentKind, registrationNo)} replace />;
}
