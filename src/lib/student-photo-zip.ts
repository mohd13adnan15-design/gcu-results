import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;
const STUDENT_PHOTOS_BUCKET = "student-photos";

export type ExtractedStudentPhoto = {
  blob: Blob;
  ext: string;
  fileName: string;
};

export type StudentPhotoUploadTarget = {
  id?: string;
  student_id: string;
  registration_no?: string | null;
  image_path?: string | null;
};

export type StudentPhotoUploadResult = {
  photosMatched: number;
  photosMissing: number;
  /** Lowercase student_id → storage path (e.g. `23MSDA105.jpg`). */
  imagePathByStudentId: Map<string, string>;
  /** Rows ready for DB update (targets that had `id`). */
  dbUpdates: Array<{ id: string; image_path: string }>;
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

/** Match ZIP images to students, upload to storage, return paths keyed by student_id. */
export async function matchAndUploadStudentPhotos(
  supabase: SupabaseClient,
  uploadedImages: Map<string, ExtractedStudentPhoto>,
  targets: StudentPhotoUploadTarget[],
): Promise<StudentPhotoUploadResult> {
  const imagePathByStudentId = new Map<string, string>();
  const dbUpdates: Array<{ id: string; image_path: string }> = [];
  let photosMatched = 0;
  let photosMissing = 0;

  if (uploadedImages.size === 0) {
    return { photosMatched, photosMissing, imagePathByStudentId, dbUpdates };
  }

  for (const student of targets) {
    const registrationNo = (student.registration_no || student.student_id).trim();
    const lookupKeys = studentPhotoLookupKeys({
      registrationNo,
      studentId: student.student_id,
      imagePath: student.image_path,
    });

    const matched = matchStudentPhotoFromZip(uploadedImages, lookupKeys);
    if (!matched) {
      photosMissing += 1;
      continue;
    }

    const storageFileName = studentPhotoStorageFileName(registrationNo, matched.ext);
    const typedBlob = toTypedStudentPhotoBlob(matched.blob, matched.ext);
    const { error: uploadErr } = await supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .upload(storageFileName, typedBlob, {
        upsert: true,
        contentType: studentPhotoContentType(matched.ext),
      });

    if (uploadErr) {
      console.error(`Error uploading photo for ${registrationNo}:`, uploadErr);
      photosMissing += 1;
      continue;
    }

    const studentKey = student.student_id.toLowerCase().trim();
    imagePathByStudentId.set(studentKey, storageFileName);
    photosMatched += 1;
    if (student.id) {
      dbUpdates.push({ id: student.id, image_path: storageFileName });
    }
  }

  return { photosMatched, photosMissing, imagePathByStudentId, dbUpdates };
}

/** Write uploaded photo paths to `students` and all `student_marksheets` for each student. */
export async function persistStudentPhotoUpdates(
  supabase: SupabaseClient,
  updates: Array<{ id: string; image_path: string }>,
): Promise<void> {
  for (const { id, image_path } of updates) {
    const { error: studentErr } = await supabase
      .from("students")
      .update({ image_path })
      .eq("id", id);
    if (studentErr) {
      throw new Error(`Failed to update student photo: ${studentErr.message}`);
    }

    const { error: marksheetErr } = await supabase
      .from("student_marksheets")
      .update({
        photo_bucket: STUDENT_PHOTOS_BUCKET,
        photo_path: image_path,
      })
      .eq("student_id", id);
    if (marksheetErr) {
      throw new Error(`Failed to update marksheet photo: ${marksheetErr.message}`);
    }
  }
}
