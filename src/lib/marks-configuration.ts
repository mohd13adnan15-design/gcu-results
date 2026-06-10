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
  { key: "total_marks_theory", label: "Total Marks Theory" },
  { key: "total_marks_practical", label: "Total Marks Practical" },
];

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

export function validateMarksConfigurationInput(
  input: MarksConfigurationInput,
): string | null {
  for (const { key, label } of MARKS_CONFIGURATION_FIELDS) {
    const value = input[key];
    if (!Number.isFinite(value) || value < 0) {
      return `${label} must be a non-negative number.`;
    }
    if (key.includes("max") || key.includes("total")) {
      if (value <= 0) return `${label} must be greater than zero.`;
    }
  }

  if (input.cia_min_marks_theory > input.cia_max_marks_theory) {
    return "CIA Min Marks Theory cannot exceed CIA Max Marks Theory.";
  }
  if (input.cia_min_marks_practical > input.cia_max_marks_practical) {
    return "CIA Min Marks Practical cannot exceed CIA Max Marks Practical.";
  }
  if (input.ese_min_marks_theory > input.ese_max_marks_theory) {
    return "ESE Min Marks Theory cannot exceed ESE Max Marks Theory.";
  }
  if (input.ese_min_marks_practical > input.ese_max_marks_practical) {
    return "ESE Min Marks Practical cannot exceed ESE Max Marks Practical.";
  }

  const theoryTotal = input.cia_max_marks_theory + input.ese_max_marks_theory;
  if (input.total_marks_theory !== theoryTotal) {
    return `Total Marks Theory should equal CIA Max + ESE Max for theory (${theoryTotal}).`;
  }
  const practicalTotal = input.cia_max_marks_practical + input.ese_max_marks_practical;
  if (input.total_marks_practical !== practicalTotal) {
    return `Total Marks Practical should equal CIA Max + ESE Max for practical (${practicalTotal}).`;
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

  if (error) {
    console.warn("fetchMarksConfiguration failed, using defaults:", error.message);
    return normalizeMarksConfiguration(null);
  }

  if (!data) {
    return normalizeMarksConfiguration(null);
  }

  return normalizeMarksConfiguration(data as Record<string, unknown>);
}

export async function saveMarksConfiguration(
  supabase: SupabaseClient,
  input: MarksConfigurationInput,
  existingId?: string,
): Promise<MarksConfiguration> {
  const validationError = validateMarksConfigurationInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("marks_configuration")
      .update(payload)
      .eq("id", existingId)
      .select("*")
      .single();

    if (error) throw error;
    return normalizeMarksConfiguration(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("marks_configuration")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeMarksConfiguration(data as Record<string, unknown>);
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
