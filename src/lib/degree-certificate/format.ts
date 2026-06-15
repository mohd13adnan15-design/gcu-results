const DEGREE_ABBREVIATIONS: Record<string, string> = {
  "bachelor of technology": "B.Tech",
  "bachelor of engineering": "B.E.",
  "master of technology": "M.Tech",
  "master of business administration": "MBA",
  "bachelor of business administration": "BBA",
  "bachelor of computer applications": "BCA",
  "master of computer applications": "MCA",
  "bachelor of science": "B.Sc",
  "master of science": "M.Sc",
  "bachelor of arts": "B.A.",
  "master of arts": "M.A.",
};

export function formatDegreeExamMonthYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";

  if (/^[A-Za-z]+\s*-\s*\d{4}$/.test(trimmed)) {
    return trimmed.replace(/\s*-\s*/, " - ");
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    const date = new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      isoMatch[3] ? Number(isoMatch[3]) : 1,
    );
    if (!Number.isNaN(date.getTime())) {
      const month = date.toLocaleDateString("en-US", { month: "long" });
      return `${month} - ${date.getFullYear()}`;
    }
  }

  const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    return `${monthYearMatch[1]} - ${monthYearMatch[2]}`;
  }

  return trimmed;
}

export function resolveDegreeCertificateLines(
  programmeTitle: string,
  department: string,
  programmeCode = "",
) {
  const title = programmeTitle.trim();
  const dept = department.trim();
  const code = programmeCode.trim().toUpperCase();

  const inMatch = title.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    const degreeFull = inMatch[1].trim();
    const specialization = inMatch[2].trim();
    const abbrev = DEGREE_ABBREVIATIONS[degreeFull.toLowerCase()] ?? degreeFull;
    const degreeName =
      abbrev !== degreeFull && specialization
        ? `${abbrev} ${specialization}`
        : degreeFull;
    return { degreeName, specialization };
  }

  const btechMatch = title.match(/^b\.?\s*tech\.?\s+(.+)$/i);
  if (btechMatch) {
    return {
      degreeName: title,
      specialization: btechMatch[1].trim() || dept || "—",
    };
  }

  if (code && dept) {
    const abbrev = DEGREE_ABBREVIATIONS[title.toLowerCase()] ?? title;
    if (abbrev !== title) {
      return { degreeName: `${abbrev} ${dept}`, specialization: dept };
    }
  }

  return {
    degreeName: title || "Degree",
    specialization: dept || "—",
  };
}

export function buildPreviewCertificateNumber(registrationNo: string): string {
  const year = new Date().getFullYear();
  const clean = registrationNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffixMatch = clean.match(/^\d{2}B?([A-Z]+\d+)$/);
  const suffix = suffixMatch?.[1] ?? clean.slice(-6);
  return `GCU-CONV-${year}-${suffix}`;
}
