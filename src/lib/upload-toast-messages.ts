export type UploadRejectedRow = {
  row: number;
  reason: string;
};

/** Short, user-friendly message for upload failures (details stay in console). */
export function formatUploadError(error: unknown): string {
  if (!(error instanceof Error)) return "Upload failed. Please try again.";

  const message = error.message.trim();
  if (/could not be read|permission problems|NotReadableError|not readable/i.test(message)) {
    return "Couldn't read that file. Close it in Excel and upload again.";
  }
  if (/Missing required columns/i.test(message)) {
    const match = message.match(/Missing required columns \(\d+\): ([^.]+)/);
    const cols = match?.[1] ?? "some columns";
    return `Template missing columns: ${cols}. Download the official template.`;
  }
  if (/No column headers/i.test(message)) {
    return "No column headers found. Use the official marks template.";
  }
  if (/No marks card data|No valid rows/i.test(message)) {
    return message;
  }
  if (message.length > 100) {
    return `${message.slice(0, 97)}...`;
  }
  return message;
}

export function formatUploadSuccessMessage(
  rowCount: number,
  studentCount: number,
  photosMatched = 0,
): string {
  const base = `Imported ${rowCount} rows for ${studentCount} student${studentCount === 1 ? "" : "s"}.`;
  if (photosMatched > 0) {
    return `${base} ${photosMatched} photo${photosMatched === 1 ? "" : "s"} matched.`;
  }
  return base;
}

export function formatPartialUploadMessage(
  rowCount: number,
  studentCount: number,
  rejected: UploadRejectedRow[],
  photosMatched = 0,
  photosMissing = 0,
): string {
  const failCount = rejected.length;
  const rowNums = [...new Set(rejected.slice(0, 4).map((r) => r.row))].join(", ");
  const more = failCount > 4 ? ` +${failCount - 4} more` : "";

  let text = `Imported ${rowCount} rows (${studentCount} students). ${failCount} row${failCount === 1 ? "" : "s"} skipped`;
  if (rowNums) text += ` (${rowNums}${more})`;
  text += ".";

  if (photosMissing > 0) {
    text += ` ${photosMissing} photo${photosMissing === 1 ? "" : "s"} not matched.`;
  } else if (photosMatched > 0) {
    text += ` ${photosMatched} photo${photosMatched === 1 ? "" : "s"} matched.`;
  }

  return text;
}
