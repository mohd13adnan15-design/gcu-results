import type { SupabaseClient } from "@supabase/supabase-js";

import { getMarksCardCourseType } from "@/lib/marks-card-helpers";
import type { MarksheetCourse, StudentMarksheet } from "@/lib/marksheet";

export type MarksConfiguration = {
  id: string;
  cia_max_marks_theory: number;
  cia_max_marks_practical: number;
  cia_min_marks_theory: number;
  cia_min_marks_practical: number;
  ese_max_marks_theory: number;
  ese_max_marks_practical: number;
  ese_min_marks_theory: number;
  ese_min_marks_practical: number;
  total_marks_theory: number;
  total_marks_practical: number;
  updated_at: string;
  updated_by: string | null;
};

export type MarksConfigurationInput = Omit<
  MarksConfiguration,
  "id" | "updated_at" | "updated_by"
>;

export const DEFAULT_MARKS_CONFIGURATION: MarksConfigurationInput = {
  cia_max_marks_theory: 40,
  cia_max_marks_practical: 40,
  cia_min_marks_theory: 16,
  cia_min_marks_practical: 16,
  ese_max_marks_theory: 60,
  ese_max_marks_practical: 60,
  ese_min_marks_theory: 24,
  ese_min_marks_practical: 24,
  total_marks_theory: 100,
  total_marks_practical: 100,
};

export const MARKS_CONFIGURATION_FIELDS: {
  key: keyof MarksConfigurationInput;
  label: string;
}[] = [
  { key: "cia_max_marks_theory", label: "CIA Max Marks Theory" },
  { key: "cia_max_marks_practical", label: "CIA Max Marks Practical" },
  { key: "cia_min_marks_theory", label: "CIA Min Marks Theory" },
  { key: "cia_min_marks_practical", label: "CIA Min Marks Practical" },
  { key: "ese_max_marks_theory", label: "ESE Max Marks Theory" },
  { key: "ese_max_marks_practical", label: "ESE Max Marks Practical" },
  { key: "ese_min_marks_theory", label: "ESE Min Marks Theory" },
  { key: "ese_min_marks_practical", label: "ESE Min Marks Practical" },
  { key: "total_marks_theory", label: "Total Max Marks Theory" },
  { key: "total_marks_practical", label: "Total Max Marks Practical" },
];

/** Editable CIA/ESE fields; total max marks are derived on save. */
export const MARKS_CONFIGURATION_EDITABLE_FIELDS = MARKS_CONFIGURATION_FIELDS.filter(
  (field) => !field.key.startsWith("total_marks"),
);

export const MARKS_CONFIGURATION_BUCKET = "student-photos";
const MARKS_CONFIGURATION_STORAGE_PATH = "_portal/marks-configuration.json";
const MARKS_CONFIGURATION_LOCAL_KEY = "gcu-marks-configuration";

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse numeric config input; strips leading zeros and non-digits. */
export function parseMarksConfigNumber(raw: string): number {
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly === "") return 0;
  const value = parseInt(digitsOnly, 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function formatMarksConfigNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isMissingMarksConfigurationTableError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("marks_configuration") ||
    message.includes("schema cache")
  );
}

function readLocalMarksConfiguration(): MarksConfiguration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MARKS_CONFIGURATION_LOCAL_KEY);
    if (!raw) return null;
    return normalizeMarksConfiguration(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

function writeLocalMarksConfiguration(record: MarksConfiguration) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MARKS_CONFIGURATION_LOCAL_KEY, JSON.stringify(record));
}

async function parseMarksConfigurationBlob(blob: Blob): Promise<MarksConfiguration | null> {
  try {
    const text = await blob.text();
    return normalizeMarksConfiguration(JSON.parse(text) as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function fetchMarksConfigurationFromStorage(
  supabase: SupabaseClient,
): Promise<MarksConfiguration | null> {
  const { data, error } = await supabase.storage
    .from(MARKS_CONFIGURATION_BUCKET)
    .download(MARKS_CONFIGURATION_STORAGE_PATH);

  if (!error && data) {
    const parsed = await parseMarksConfigurationBlob(data);
    if (parsed) return parsed;
  }

  const publicUrl = supabase.storage
    .from(MARKS_CONFIGURATION_BUCKET)
    .getPublicUrl(MARKS_CONFIGURATION_STORAGE_PATH).data.publicUrl;

  try {
    const response = await fetch(publicUrl, { cache: "no-store" });
    if (!response.ok) return null;
    return parseMarksConfigurationBlob(await response.blob());
  } catch {
    return null;
  }
}

async function saveMarksConfigurationToStorage(
  supabase: SupabaseClient,
  prepared: MarksConfigurationInput,
  userId: string | null,
): Promise<MarksConfiguration> {
  const record = normalizeMarksConfiguration({
    id: "storage",
    ...prepared,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  writeLocalMarksConfiguration(record);

  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });

  const { error } = await supabase.storage
    .from(MARKS_CONFIGURATION_BUCKET)
    .upload(MARKS_CONFIGURATION_STORAGE_PATH, blob, {
      upsert: true,
      contentType: "application/json",
    });

  if (error && !readLocalMarksConfiguration()) {
    throw new Error(supabaseErrorMessage(error, "Could not save marks configuration."));
  }

  return record;
}

async function resolveMarksConfigurationId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("marks_configuration")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data?.id ? String(data.id) : null;
}

export function normalizeMarksConfiguration(row: Record<string, unknown> | null): MarksConfiguration {
  const defaults = DEFAULT_MARKS_CONFIGURATION;
  return {
    id: String(row?.id ?? ""),
    cia_max_marks_theory: toNumber(row?.cia_max_marks_theory, defaults.cia_max_marks_theory),
    cia_max_marks_practical: toNumber(row?.cia_max_marks_practical, defaults.cia_max_marks_practical),
    cia_min_marks_theory: toNumber(row?.cia_min_marks_theory, defaults.cia_min_marks_theory),
    cia_min_marks_practical: toNumber(row?.cia_min_marks_practical, defaults.cia_min_marks_practical),
    ese_max_marks_theory: toNumber(row?.ese_max_marks_theory, defaults.ese_max_marks_theory),
    ese_max_marks_practical: toNumber(row?.ese_max_marks_practical, defaults.ese_max_marks_practical),
    ese_min_marks_theory: toNumber(row?.ese_min_marks_theory, defaults.ese_min_marks_theory),
    ese_min_marks_practical: toNumber(row?.ese_min_marks_practical, defaults.ese_min_marks_practical),
    total_marks_theory: toNumber(row?.total_marks_theory, defaults.total_marks_theory),
    total_marks_practical: toNumber(row?.total_marks_practical, defaults.total_marks_practical),
    updated_at: String(row?.updated_at ?? new Date().toISOString()),
    updated_by: row?.updated_by ? String(row.updated_by) : null,
  };
}

/** Sync total max marks from CIA + ESE max before save. */
export function prepareMarksConfigurationForSave(
  input: MarksConfigurationInput,
): MarksConfigurationInput {
  return {
    ...input,
    total_marks_theory: input.cia_max_marks_theory + input.ese_max_marks_theory,
    total_marks_practical: input.cia_max_marks_practical + input.ese_max_marks_practical,
  };
}

export function validateMarksConfigurationInput(
  input: MarksConfigurationInput,
): string | null {
  const prepared = prepareMarksConfigurationForSave(input);

  for (const { key, label } of MARKS_CONFIGURATION_FIELDS) {
    const value = prepared[key];
    if (!Number.isFinite(value) || value < 0) {
      return `${label} must be a non-negative number.`;
    }
    if (key.startsWith("cia_max") || key.startsWith("total_marks")) {
      if (value <= 0) return `${label} must be greater than zero.`;
    }
  }

  if (prepared.cia_min_marks_theory > prepared.cia_max_marks_theory) {
    return "CIA Min Marks Theory cannot exceed CIA Max Marks Theory.";
  }
  if (prepared.cia_min_marks_practical > prepared.cia_max_marks_practical) {
    return "CIA Min Marks Practical cannot exceed CIA Max Marks Practical.";
  }
  if (prepared.ese_min_marks_theory > prepared.ese_max_marks_theory) {
    return "ESE Min Marks Theory cannot exceed ESE Max Marks Theory.";
  }
  if (prepared.ese_min_marks_practical > prepared.ese_max_marks_practical) {
    return "ESE Min Marks Practical cannot exceed ESE Max Marks Practical.";
  }

  return null;
}

export async function fetchMarksConfiguration(
  supabase: SupabaseClient,
): Promise<MarksConfiguration> {
  const { data, error } = await supabase
    .from("marks_configuration")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    const record = normalizeMarksConfiguration(data as Record<string, unknown>);
    writeLocalMarksConfiguration(record);
    return record;
  }

  if (error && !isMissingMarksConfigurationTableError(error)) {
    console.warn("fetchMarksConfiguration failed, trying storage fallback:", error.message);
  }

  const fromStorage = await fetchMarksConfigurationFromStorage(supabase);
  if (fromStorage) {
    writeLocalMarksConfiguration(fromStorage);
    return fromStorage;
  }

  const fromLocal = readLocalMarksConfiguration();
  if (fromLocal) return fromLocal;

  return {
    ...normalizeMarksConfiguration(null),
    id: "",
    updated_at: "",
  };
}

export async function saveMarksConfiguration(
  supabase: SupabaseClient,
  input: MarksConfigurationInput,
  existingId?: string,
): Promise<MarksConfiguration> {
  const prepared = prepareMarksConfigurationForSave(input);
  const validationError = validateMarksConfigurationInput(prepared);
  if (validationError) {
    throw new Error(validationError);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...prepared,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };

  const targetId = existingId?.trim() || (await resolveMarksConfigurationId(supabase));

  if (targetId) {
    const { data, error } = await supabase
      .from("marks_configuration")
      .update(payload)
      .eq("id", targetId)
      .select("*")
      .maybeSingle();

    if (error && !isMissingMarksConfigurationTableError(error)) {
      throw new Error(supabaseErrorMessage(error, "Could not update marks configuration."));
    }
    if (data) {
      const record = normalizeMarksConfiguration(data as Record<string, unknown>);
      writeLocalMarksConfiguration(record);
      return record;
    }
  }

  const { data, error } = await supabase
    .from("marks_configuration")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) {
    const record = normalizeMarksConfiguration(data as Record<string, unknown>);
    writeLocalMarksConfiguration(record);
    return record;
  }

  if (error && !isMissingMarksConfigurationTableError(error)) {
    throw new Error(supabaseErrorMessage(error, "Could not save marks configuration."));
  }

  return saveMarksConfigurationToStorage(supabase, prepared, user?.id ?? null);
}

/** Apply global marks limits to a course (theory vs practical). Obtained marks are unchanged. */
export function applyMarksConfigurationToCourse(
  course: MarksheetCourse,
  config: MarksConfigurationInput,
): MarksheetCourse {
  const courseType = getMarksCardCourseType(course);
  const isPractical = courseType === "PRACTICAL";

  if (isPractical) {
    return {
      ...course,
      cia_max_marks_theory: 0,
      cia_max_marks_practical: config.cia_max_marks_practical,
      cia_min_marks_theory: 0,
      cia_min_marks_practical: config.cia_min_marks_practical,
      ese_max_marks_theory: 0,
      ese_max_marks_practical: config.ese_max_marks_practical,
      ese_min_marks_theory: 0,
      ese_min_marks_practical: config.ese_min_marks_practical,
      total_marks_theory: 0,
      total_marks_practical: config.total_marks_practical,
      max_marks: config.total_marks_practical,
    };
  }

  return {
    ...course,
    cia_max_marks_theory: config.cia_max_marks_theory,
    cia_max_marks_practical: 0,
    cia_min_marks_theory: config.cia_min_marks_theory,
    cia_min_marks_practical: 0,
    ese_max_marks_theory: config.ese_max_marks_theory,
    ese_max_marks_practical: 0,
    ese_min_marks_theory: config.ese_min_marks_theory,
    ese_min_marks_practical: 0,
    total_marks_theory: config.total_marks_theory,
    total_marks_practical: 0,
    max_marks: config.total_marks_theory,
  };
}

export function deriveTotalMinMarks(config: MarksConfigurationInput): {
  theory: number;
  practical: number;
} {
  return {
    theory: config.cia_min_marks_theory + config.ese_min_marks_theory,
    practical: config.cia_min_marks_practical + config.ese_min_marks_practical,
  };
}

export function applyMarksConfigurationToMarksheet(
  marksheet: StudentMarksheet,
  config: MarksConfigurationInput,
): StudentMarksheet {
  return {
    ...marksheet,
    courses: (marksheet.courses ?? []).map((course) =>
      applyMarksConfigurationToCourse(course, config),
    ),
  };
}

export async function enrichMarksheetWithConfiguration(
  supabase: SupabaseClient,
  marksheet: StudentMarksheet,
): Promise<StudentMarksheet> {
  const config = await fetchMarksConfiguration(supabase);
  return applyMarksConfigurationToMarksheet(marksheet, config);
}
