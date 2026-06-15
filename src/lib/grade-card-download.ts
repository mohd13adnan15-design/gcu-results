import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGradeCardFrontPages } from "@/lib/grade-card-filter";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import {
  generateAllSemestersPdfFromTemplate,
  generateMarksheetPdfFromTemplate,
} from "@/lib/grade-card-pdf";
import { loadTransparentAsset } from "@/lib/grade-card-image-processing";
import {
  applyMarksConfigurationToMarksheet,
  fetchMarksConfiguration,
} from "@/lib/marks-configuration";
import type { BackPageSignatureOptions } from "@/lib/marksheet-documents";
import {
  resolveStudentPhotoForGradeCard,
  type StudentMarksheet,
} from "@/lib/marksheet";

export type GradeCardDownloadContext = {
  studentUuid: string;
  registrationNo?: string | null;
  semesterLabels?: string[];
};

async function resolveBackPageSignaturesForRender(
  supabase: SupabaseClient,
  studentId: string,
): Promise<BackPageSignatureOptions> {
  const sigs = await fetchApprovedBackPageSignatures(supabase, studentId);
  const [checkedByUrl, verifiedByUrl] = await Promise.all([
    sigs.checkedByUrl ? loadTransparentAsset(sigs.checkedByUrl) : Promise.resolve(null),
    sigs.verifiedByUrl ? loadTransparentAsset(sigs.verifiedByUrl) : Promise.resolve(null),
  ]);
  return { checkedByUrl, verifiedByUrl };
}

function logGradeCardDownload(stage: string, context: GradeCardDownloadContext, extra?: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[grade-card-download] ${stage}`, {
      studentId: context.studentUuid,
      registrationNo: context.registrationNo,
      semesters: context.semesterLabels,
      ...((extra && typeof extra === "object") ? extra : { detail: extra }),
    });
  }
}

function summarizeMarksheet(sheet: StudentMarksheet) {
  return {
    semester: sheet.semester_label,
    registrationNo: sheet.registration_no,
    sgpa: sheet.sgpa,
    courseCount: sheet.courses?.length ?? 0,
    studentName: sheet.student_name,
  };
}

export async function downloadStudentGradeCardPdf(
  supabase: SupabaseClient,
  marksheet: StudentMarksheet,
  allMarksheets: StudentMarksheet[],
  context: GradeCardDownloadContext,
): Promise<Blob> {
  logGradeCardDownload("single-semester:start", context, summarizeMarksheet(marksheet));

  const config = await fetchMarksConfiguration(supabase);
  const enrichedMarksheet = applyMarksConfigurationToMarksheet(marksheet, config);
  const enrichedAll = allMarksheets.map((sheet) =>
    applyMarksConfigurationToMarksheet(sheet, config),
  );

  const frontPages = buildGradeCardFrontPages(enrichedMarksheet, enrichedAll, false);
  if (frontPages.length === 0) {
    throw new Error("No grade card pages to generate for the selected semester.");
  }

  const [photoUrl, backPageSignatures] = await Promise.all([
    resolveStudentPhotoForGradeCard(supabase, enrichedMarksheet, {
      studentUuid: context.studentUuid,
    }),
    resolveBackPageSignaturesForRender(supabase, context.studentUuid),
  ]);

  logGradeCardDownload("single-semester:render", context, {
    photoResolved: Boolean(photoUrl),
    frontPageCount: frontPages.length,
  });

  return generateMarksheetPdfFromTemplate(enrichedMarksheet, {
    photoUrl,
    allMarksheets: enrichedAll,
    backPageSignatures,
  });
}

export async function downloadStudentAllSemestersGradeCardPdf(
  supabase: SupabaseClient,
  marksheets: StudentMarksheet[],
  context: GradeCardDownloadContext,
): Promise<Blob> {
  if (marksheets.length === 0) {
    throw new Error("No marksheet data found for this student.");
  }

  logGradeCardDownload("all-semesters:start", context, {
    sheets: marksheets.map(summarizeMarksheet),
  });

  const config = await fetchMarksConfiguration(supabase);
  const enrichedMarksheets = marksheets.map((sheet) =>
    applyMarksConfigurationToMarksheet(sheet, config),
  );

  const photoSource = enrichedMarksheets[0];
  if (!photoSource) {
    throw new Error("No grade card data to generate.");
  }

  const [photoUrl, backPageSignatures] = await Promise.all([
    resolveStudentPhotoForGradeCard(supabase, photoSource, {
      studentUuid: context.studentUuid,
    }),
    resolveBackPageSignaturesForRender(supabase, context.studentUuid),
  ]);

  logGradeCardDownload("all-semesters:render", context, {
    photoResolved: Boolean(photoUrl),
    semesterCount: enrichedMarksheets.length,
  });

  return generateAllSemestersPdfFromTemplate(enrichedMarksheets, {
    photoUrl,
    backPageSignatures,
  });
}

export function formatGradeCardDownloadError(error: unknown, fallback: string): string {
  console.error("[grade-card-download] failed:", error);
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
