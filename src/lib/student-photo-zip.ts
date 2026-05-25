import JSZip from "jszip";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;

export type ExtractedStudentPhoto = {
  blob: Blob;
  ext: string;
  fileName: string;
};

/** Extract jpg/png images from a ZIP; keys are lowercase base filenames (e.g. `23msda105.jpg`). */
export async function extractStudentPhotosFromZip(
  zipFile: File,
): Promise<Map<string, ExtractedStudentPhoto>> {
  const zip = await JSZip.loadAsync(zipFile);
  const uploadedImages = new Map<string, ExtractedStudentPhoto>();

  for (const [filename, fileObj] of Object.entries(zip.files)) {
    if (fileObj.dir) continue;

    const lowerName = filename.toLowerCase();
    if (!IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) continue;

    const baseName = (filename.split("/").pop() || filename).toLowerCase().trim();
    const ext = baseName.split(".").pop() || "jpg";
    const raw = await fileObj.async("uint8array");
    const content = new Blob([raw], { type: studentPhotoContentType(ext) });

    uploadedImages.set(baseName, { blob: content, ext, fileName: baseName });
  }

  return uploadedImages;
}

/** Build lookup keys for matching ZIP filenames to a student (registration no is primary). */
export function studentPhotoLookupKeys({
  registrationNo,
  studentId,
  imagePath,
}: {
  registrationNo?: string | null;
  studentId?: string | null;
  imagePath?: string | null;
}): string[] {
  const keys = new Set<string>();

  const addBase = (value?: string | null) => {
    const trimmed = String(value || "").trim().toLowerCase();
    if (!trimmed) return;
    keys.add(trimmed);
    for (const ext of IMAGE_EXTENSIONS) {
      keys.add(`${trimmed}${ext}`);
    }
  };

  if (imagePath) {
    const base = imagePath.split("/").pop()?.toLowerCase().trim();
    if (base) keys.add(base);
  }

  addBase(registrationNo);
  addBase(studentId);

  return [...keys];
}

export function matchStudentPhotoFromZip(
  uploadedImages: Map<string, ExtractedStudentPhoto>,
  lookupKeys: string[],
): ExtractedStudentPhoto | null {
  for (const key of lookupKeys) {
    const match = uploadedImages.get(key.toLowerCase().trim());
    if (match) return match;
  }
  return null;
}

/** Storage object name: `{registrationNo}.{ext}` (e.g. `23MSDA105.jpg`). */
export function studentPhotoStorageFileName(registrationNo: string, ext: string): string {
  const safeReg = registrationNo.trim();
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "jpg";
  return `${safeReg}.${safeExt}`;
}

/** Likely flat storage paths for a registration number (ZIP upload naming). */
export function studentPhotoCandidatePaths(registrationNo: string): string[] {
  const safeReg = registrationNo.trim();
  if (!safeReg) return [];
  const flat = [
    `${safeReg}.jpg`,
    `${safeReg}.jpeg`,
    `${safeReg}.png`,
    `${safeReg}.JPG`,
    `${safeReg}.JPEG`,
    `${safeReg}.PNG`,
  ];
  const folder = ["profile.jpeg", "profile.jpg", "profile.png"].map(
    (name) => `${safeReg}/${name}`,
  );
  return [...flat, ...folder];
}

export function studentPhotoContentType(ext: string): string {
  const normalized = ext.replace(/^\./, "").toLowerCase();
  if (normalized === "png") return "image/png";
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

/** Re-wrap a blob with the correct image MIME type for Supabase storage upload. */
export function toTypedStudentPhotoBlob(blob: Blob, ext: string): Blob {
  const type = studentPhotoContentType(ext);
  if (blob.type === type) return blob;
  return new Blob([blob], { type });
}
