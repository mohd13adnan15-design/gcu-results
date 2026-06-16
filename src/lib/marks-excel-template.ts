import { resolveCourseStatus } from "@/lib/marks-card-helpers";
import {
  DEFAULT_MARKS_CONFIGURATION,
  type MarksConfigurationInput,
} from "@/lib/marks-configuration";
import { mapObtainedMarksToStorage } from "@/lib/marks-resolution";

export function toRoman(num: number | string): string {
  const n = typeof num === 'number' ? num : parseInt(String(num), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return String(num).toUpperCase();
  const map: Record<number, string> = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
    9: "IX", 10: "X"
  };
  return map[n] || String(n);
}

export function romanToNum(roman: string | number | null | undefined): number {
  if (roman === null || roman === undefined || roman === "") return 0;
  if (typeof roman === "number") return roman;
  const clean = String(roman).trim().toUpperCase();
  if (!clean) return 0;

  const n = parseInt(clean, 10);
  if (Number.isFinite(n) && !Number.isNaN(n)) return n;

  const map: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    IX: 9, X: 10
  };
  return map[clean] || 0;
}


export const GCU_MARKS_TEMPLATE_HEADERS_LEGACY = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Max Marks Theory", "CIA Max Marks Practical", "CIA Marks Obtained Theory", "CIA Marks Obtained Practical",
  "ESE Max Marks Theory", "ESE Max Marks Practical", "ESE Marks Obtained Theory", "ESE Marks Obtained Practical",
  "Total Marks Theory", "Total Marks Practical", "Grade Obtained", "Grade Points",
] as const;

/** Current COE upload template — obtained marks use Course Type; limits from Marks Configuration. */
export const GCU_MARKS_TEMPLATE_HEADERS = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Obtained", "ESE Obtained",
  "Status", "Grade Obtained", "Grade Points",
] as const;

/** Previous template with separate theory/practical obtained columns (still supported on import). */
export const GCU_MARKS_TEMPLATE_HEADERS_SPLIT_OBTAINED = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Marks Obtained Theory", "CIA Marks Obtained Practical",
  "ESE Marks Obtained Theory", "ESE Marks Obtained Practical",
  "Status", "Grade Obtained", "Grade Points",
] as const;

/** Legacy extended template that still included per-row CIA/ESE limits (ignored on import). */
export const GCU_MARKS_TEMPLATE_HEADERS_WITH_STATIC_LIMITS = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Max Marks Theory", "CIA Max Marks Practical", "CIA Min Marks Theory", "CIA Min Marks Practical",
  "CIA Marks Obtained Theory", "CIA Marks Obtained Practical",
  "ESE Max Marks Theory", "ESE Max Marks Practical", "ESE Min Marks Theory", "ESE Min Marks Practical",
  "ESE Marks Obtained Theory", "ESE Marks Obtained Practical",
  "Total Marks Theory", "Total Marks Practical", "Status", "Grade Obtained", "Grade Points",
] as const;

export type MarksObtainedFormat = "unified" | "split" | "legacy_simple";

export function detectMarksObtainedFormat(keys: Iterable<string>): MarksObtainedFormat {
  const normalized = new Set(Array.from(keys).map(normalizeExcelHeaderKey));
  const hasUnified =
    (normalized.has("ciaobtained") ||
      normalized.has("ciamarksobtained")) &&
    !normalized.has("ciamarksobtainedtheory") &&
    !normalized.has("ciamarksobtainedpractical");
  if (hasUnified) return "unified";
  if (
    normalized.has("ciamarksobtainedtheory") ||
    normalized.has("ciamarksobtainedpractical") ||
    normalized.has("esemarksobtainedtheory") ||
    normalized.has("esemarksobtainedpractical")
  ) {
    return "split";
  }
  return "legacy_simple";
}

export function detectGcuMarksTemplateHeaders(aoa: unknown[][]): readonly string[] {
  const rowText = (aoa[0] ?? []).map((c) => String(c ?? "").toLowerCase()).join("|");
  const maxCols = Math.max(...aoa.slice(0, 6).map((row) => (row ?? []).length), 0);
  if (rowText.includes("cia max marks theory") || rowText.includes("cia min") || maxCols >= 33) {
    return GCU_MARKS_TEMPLATE_HEADERS_WITH_STATIC_LIMITS;
  }
  if (rowText.includes("cia marks obtained theory")) {
    return GCU_MARKS_TEMPLATE_HEADERS_SPLIT_OBTAINED;
  }
  if (
    rowText.includes("cia obtained") ||
    rowText.includes("cia marks obtained") ||
    rowText.includes("status")
  ) {
    return GCU_MARKS_TEMPLATE_HEADERS;
  }
  return GCU_MARKS_TEMPLATE_HEADERS_LEGACY;
}

/** Full template - one row per course; repeat student/header columns on every row (same as typical Excel marks uploads). */
export const MARKS_TEMPLATE_HEADERS_FULL = [
  "Sl No",
  "Student ID",
  "Email",
  "Password",
  "Student Name",
  "Department",
  "Semester",
  "Year",
  "University",
  "School Name",
  "Programme Title",
  "Programme Code",
  "Registration No",
  "Exam Month & Year",
  "Issue Date",
  "Semester Label",
  "Grade Card No",
  "Course Category",
  "Course Code",
  "Course Title",
  "Course Credits",
  "Credits Earned",
  "Marks Obtained",
  "Max Marks",
  "Grade Obtained",
  "Grade Points",
] as const;

export type MarksTemplateHeaderFull = (typeof MARKS_TEMPLATE_HEADERS_FULL)[number];

/** Normalize a header key for safe lookup (production-ready). */
export function normalizeExcelHeaderKey(key: string | number | null | undefined): string {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Suggested production regex
    .trim();
}

/** Sanitize numeric fields (marks, credits) from various Excel formats. */
export function cleanNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  // Suggested production-ready cleaning
  const cleaned = String(value)
    .replace(/[^0-9.-]/g, "")
    .trim();

  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Map Excel row object to canonical lowercase keys for parsing. */
export function normalizeExcelRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeExcelHeaderKey(k)] = v;
  }
  return out;
}

function cell(nc: Record<string, unknown>, ...aliases: string[]): string {
  for (const a of aliases) {
    const v = nc[normalizeExcelHeaderKey(a)];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      if (v instanceof Date) {
        return v.toISOString().split("T")[0];
      }
      return String(v).trim();
    }
  }
  return "";
}

function cellNum(nc: Record<string, unknown>, ...aliases: string[]): number {
  const s = cell(nc, ...aliases);
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export type ParsedMarksCourseRow = {
  sl_no: number;
  student_id: string;
  email: string;
  full_name: string;
  department: string;
  semester: number;
  year: number;
  university: string;
  school_name: string;
  programme_title: string;
  programme_code: string;
  registration_no: string;
  exam_month_year: string;
  issue_date: string;
  semester_label: string;
  grade_card_no: string;
  course_category: string;
  subject_code: string;
  subject: string;
  course_priority: number;
  credits: number;
  credits_earned: number;
  cia_max_marks_theory: number;
  cia_max_marks_practical: number;
  cia_min_marks_theory: number;
  cia_min_marks_practical: number;
  cia_marks_obtained: number;
  ese_marks_obtained: number;
  cia_marks_obtained_theory: number | null;
  cia_marks_obtained_practical: number | null;
  ese_max_marks_theory: number;
  ese_max_marks_practical: number;
  ese_min_marks_theory: number;
  ese_min_marks_practical: number;
  ese_marks_obtained_theory: number | null;
  ese_marks_obtained_practical: number | null;
  total_marks_theory: number;
  total_marks_practical: number;
  marks_obtained: number;
  max_marks: number;
  course_type: string;
  course_status: string;
  grade: string;
  grade_points: number;
  image_path?: string;
};

export function gradePointsFromGradeLetter(grade: string): number {
  switch (grade.toUpperCase()) {
    case "O":
      return 10;
    case "A+":
      return 9;
    case "A":
      return 8;
    case "B+":
      return 7;
    case "B":
      return 6;
    case "C":
      return 5;
    case "RA":
      return 0;
    default:
      return 0;
  }
}

export function autoGradeFromPct(obtained: number, max: number): string {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  if (pct >= 90) return "O";
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B+";
  if (pct >= 50) return "B";
  if (pct >= 40) return "C";
  return "RA";
}

function staticMarksFromConfiguration(
  isPractical: boolean,
  config: MarksConfigurationInput,
): Pick<
  ParsedMarksCourseRow,
  | "cia_max_marks_theory"
  | "cia_max_marks_practical"
  | "cia_min_marks_theory"
  | "cia_min_marks_practical"
  | "ese_max_marks_theory"
  | "ese_max_marks_practical"
  | "ese_min_marks_theory"
  | "ese_min_marks_practical"
  | "total_marks_theory"
  | "total_marks_practical"
  | "max_marks"
> {
  if (isPractical) {
    return {
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

/** Parse one normalized row into structured fields (same logic as legacy strict template, with extra header fields). */
export function parseMarksTemplateRow(
  nc: Record<string, unknown>,
  config: MarksConfigurationInput = DEFAULT_MARKS_CONFIGURATION,
): ParsedMarksCourseRow | null {
  const student_id = cell(nc, "Student ID", "student id", "registration no", "registrationno", "reg no");
  const email = cell(nc, "Email", "email").toLowerCase();
  const full_name = cell(nc, "Student Name", "student name");
  const subject_code = cell(nc, "Course Code", "course code");
  const subject = cell(nc, "Course Title", "course title");
  if (!student_id || !full_name || !subject_code || !subject) {
    return null;
  }

  const slRaw = cellNum(nc, "Sl No", "sl no", "serial");
  const sl_no = Number.isFinite(slRaw) ? slRaw : 0;

  const department = cell(nc, "Department", "department") || "CSE";
  const university = cell(nc, "University", "university") || "Garden City University";
  const school_name =
    cell(nc, "School Name", "school name") || "SCHOOL OF ENGINEERING AND TECHNOLOGY";
  const programme_title = cell(nc, "Programme Title", "programme title");
  const programme_code = cell(nc, "Programme Code", "programme code");
  const registration_no = cell(nc, "Registration No", "registration no", "registrationno") || student_id;
  const exam_month_year = cell(nc, "Exam Month & Year", "exam month & year");
  const issue_date = cell(nc, "Issue Date", "issue date");
  const semester_label = cell(nc, "Semester Label", "semester label");
  const grade_card_no = cell(nc, "Grade Card No", "grade card no");

  const semesterRaw = cell(nc, "Semester", "semester");
  let semester = romanToNum(semesterRaw);
  if (!semester) {
    const semesterParsed = parseInt(semester_label.replace(/\D/g, ""), 10);
    semester = Number.isFinite(semesterParsed) ? semesterParsed : 1;
  }
  const yearRaw = cell(nc, "Year", "year");
  const year = Number(yearRaw) || Math.ceil(semester / 2) || 1;

  const course_category = cell(nc, "Course Category", "course category") || "CORE COURSE";
  const course_priority = cellNum(nc, "Course Priority", "course priority", "priority") || 1;
  const credits = Number(cell(nc, "Course Credits", "course credits", "credits")) || 0;

  const courseType = cell(nc, "Course Type", "coursetype") || "";
  const isPractical = courseType.toUpperCase().includes("PRACTICAL") || String(course_category).toUpperCase().includes("PRACTICAL");

  const obtainedFormat = detectMarksObtainedFormat(Object.keys(nc));
  let cia_obt_raw = 0;
  let ese_obt_raw = 0;

  if (obtainedFormat === "unified") {
    cia_obt_raw =
      cellNum(nc, "CIA Obtained", "CIA Marks Obtained", "ciamarksobtained", "ciaobtained") || 0;
    ese_obt_raw =
      cellNum(nc, "ESE Obtained", "ESE Marks Obtained", "esemarksobtained", "eseobtained") || 0;
  } else if (obtainedFormat === "split") {
    const cia_obt_theory_raw = cellNum(nc, "CIA Marks Obtained Theory", "ciamarksobtainedtheory");
    const cia_obt_practical_raw = cellNum(nc, "CIA Marks Obtained Practical", "ciamarksobtainedpractical");
    const ese_obt_theory_raw = cellNum(nc, "ESE Marks Obtained Theory", "esemarksobtainedtheory");
    const ese_obt_practical_raw = cellNum(nc, "ESE Marks Obtained Practical", "esemarksobtainedpractical");
    cia_obt_raw =
      (isPractical ? cia_obt_practical_raw : cia_obt_theory_raw) ||
      cellNum(nc, "CIA Marks Obtained", "ciamarksobtained") ||
      0;
    ese_obt_raw =
      (isPractical ? ese_obt_practical_raw : ese_obt_theory_raw) ||
      cellNum(nc, "ESE Marks Obtained", "esemarksobtained") ||
      0;
  } else {
    cia_obt_raw =
      cellNum(nc, "CIA Obtained", "CIA Marks Obtained", "ciamarksobtained", "ciaobtained") || 0;
    ese_obt_raw =
      cellNum(nc, "ESE Obtained", "ESE Marks Obtained", "esemarksobtained", "eseobtained") || 0;
    if (!cia_obt_raw && !ese_obt_raw) {
      const marksObtained = cellNum(nc, "Marks Obtained", "marksobtained");
      if (Number.isFinite(marksObtained)) {
        cia_obt_raw = marksObtained * 0.4;
        ese_obt_raw = marksObtained * 0.6;
      }
    }
  }

  // Total obtained is never read from Excel — always CIA + ESE.

  const staticMarks = staticMarksFromConfiguration(isPractical, config);
  const {
    cia_max_marks_theory,
    cia_max_marks_practical,
    cia_min_marks_theory,
    cia_min_marks_practical,
    ese_max_marks_theory,
    ese_max_marks_practical,
    ese_min_marks_theory,
    ese_min_marks_practical,
    total_marks_theory,
    total_marks_practical,
    max_marks,
  } = staticMarks;

  const resolvedCourseType = courseType || (isPractical ? "PRACTICAL" : "THEORY");
  const storedObtained = mapObtainedMarksToStorage(resolvedCourseType, cia_obt_raw, ese_obt_raw);

  const marks_obtained = cia_obt_raw + ese_obt_raw;

  const gradeRaw = cell(nc, "Grade Obtained", "grade obtained", "Grade").toUpperCase();
  const grade =
    gradeRaw ||
    (Number.isFinite(marks_obtained) ? autoGradeFromPct(marks_obtained, max_marks) : "RA");
  const statusRaw = cell(nc, "Status", "status", "Pass/Fail", "passfail");
  const course_status = resolveCourseStatus(statusRaw, grade);
  const credits_earned =
    Number(cell(nc, "Credits Earned", "credits earned")) || (grade === "RA" ? 0 : credits);
  const gpStr = cell(nc, "Grade Points", "grade points");
  const grade_points =
    gpStr === "" || gpStr === undefined
      ? gradePointsFromGradeLetter(grade)
      : Number(gpStr) || gradePointsFromGradeLetter(grade);

  return {
    sl_no,
    student_id,
    email,
    full_name,
    department,
    semester,
    year,
    university,
    school_name,
    programme_title,
    programme_code,
    registration_no,
    exam_month_year,
    issue_date,
    semester_label,
    grade_card_no,
    course_category,
    subject_code,
    subject,
    course_priority,
    credits,
    credits_earned,
    cia_max_marks_theory,
    cia_max_marks_practical,
    cia_min_marks_theory,
    cia_min_marks_practical,
    cia_marks_obtained: storedObtained.cia_marks_obtained,
    ese_marks_obtained: storedObtained.ese_marks_obtained,
    cia_marks_obtained_theory: storedObtained.cia_marks_obtained_theory,
    cia_marks_obtained_practical: storedObtained.cia_marks_obtained_practical,
    ese_max_marks_theory,
    ese_max_marks_practical,
    ese_min_marks_theory,
    ese_min_marks_practical,
    ese_marks_obtained_theory: storedObtained.ese_marks_obtained_theory,
    ese_marks_obtained_practical: storedObtained.ese_marks_obtained_practical,
    total_marks_theory,
    total_marks_practical,
    marks_obtained: Number.isFinite(marks_obtained) ? marks_obtained : 0,
    max_marks,
    course_type: resolvedCourseType,
    course_status,
    grade,
    grade_points,
  };
}

/** Merge two-row grouped Excel headers (row 0 + row 1) into flat column labels. */
export function mergeGroupedExcelHeaders(row0: unknown[], row1: unknown[]): string[] {
  const headers: string[] = [];
  let lastMainHeader = "";
  for (let i = 0; i < Math.max(row0.length, row1.length); i++) {
    const top = String(row0[i] ?? "").trim();
    if (top) lastMainHeader = top;

    const sub = String(row1[i] ?? "").trim();
    if (sub && lastMainHeader) {
      headers[i] = `${lastMainHeader} ${sub}`;
    } else if (sub) {
      headers[i] = sub;
    } else if (lastMainHeader) {
      headers[i] = lastMainHeader;
    }
  }
  return headers.filter((header) => header.trim() !== "");
}

/** Pick the full column set that matches the uploaded header layout. */
export function resolveExpectedMarksTemplateHeaders(uploadedHeaders: string[]): readonly string[] {
  const keys = new Set(uploadedHeaders.map((header) => normalizeExcelHeaderKey(header)));
  const joined = uploadedHeaders.map((header) => String(header).toLowerCase()).join("|");

  if (
    joined.includes("cia max marks theory") ||
    joined.includes("cia min") ||
    uploadedHeaders.filter(Boolean).length >= 33
  ) {
    return GCU_MARKS_TEMPLATE_HEADERS_WITH_STATIC_LIMITS;
  }
  if (keys.has("ciamarksobtainedtheory") || joined.includes("cia marks obtained theory")) {
    return GCU_MARKS_TEMPLATE_HEADERS_SPLIT_OBTAINED;
  }
  if (keys.has("ciaobtained") || keys.has("status")) {
    return GCU_MARKS_TEMPLATE_HEADERS;
  }
  if (keys.has("studentid") && keys.has("marksobtained") && keys.has("maxmarks")) {
    return MARKS_TEMPLATE_HEADERS_FULL;
  }
  return GCU_MARKS_TEMPLATE_HEADERS_LEGACY;
}

export function validateMarksTemplateHeadersAgainstExpected(
  uploadedHeaders: string[],
  expectedHeaders: readonly string[],
): void {
  const cleaned = uploadedHeaders.map((header) => String(header).trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("No column headers found in the Excel sheet.");
  }

  const uploadedKeys = new Set(cleaned.map(normalizeExcelHeaderKey));
  const missing = expectedHeaders.filter(
    (column) => !uploadedKeys.has(normalizeExcelHeaderKey(column)),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required columns (${missing.length}): ${missing.join(", ")}. ` +
        `The marks template requires all ${expectedHeaders.length} columns. Download the official template.`,
    );
  }
}

/** Ensure every column from the detected marks template is present in the upload. */
export function validateMarksTemplateHeaders(uploadedHeaders: string[]): void {
  const cleaned = uploadedHeaders.map((header) => String(header).trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("No column headers found in the Excel sheet.");
  }

  const expectedHeaders = resolveExpectedMarksTemplateHeaders(cleaned);
  validateMarksTemplateHeadersAgainstExpected(cleaned, expectedHeaders);
}

/** @deprecated Use validateMarksTemplateHeaders — kept for callers passing a parsed row object. */
export function validateMarksTemplateColumns(sampleRow: Record<string, unknown>): void {
  validateMarksTemplateHeaders(Object.keys(sampleRow));
}

const TEMPLATE_SAMPLE_COURSES = [
  { code: "SUB101", title: "Introduction to Subject One", type: "THEORY", grade: "A", points: 8 },
  { code: "SUB102", title: "Introduction to Subject Two", type: "THEORY", grade: "A+", points: 9 },
  { code: "SUB103", title: "Introduction to Subject Three", type: "THEORY", grade: "A", points: 8 },
  { code: "SUB104", title: "Advanced Subject Four", type: "THEORY", grade: "B+", points: 7 },
  { code: "SUB105", title: "Introduction to Subject Five", type: "THEORY", grade: "A", points: 8 },
  { code: "SUB106", title: "Introduction to Subject Six", type: "THEORY", grade: "A+", points: 9 },
  { code: "SUB107P", title: "Practical Lab One", type: "PRACTICAL", grade: "O", points: 10 },
  { code: "SUB108P", title: "Practical Lab Two", type: "PRACTICAL", grade: "O", points: 10 },
] as const;

function buildTemplateCourseRow(
  student: {
    slStart: number;
    roll: string;
    email: string;
    name: string;
    dept: string;
    programmeTitle: string;
    programmeCode: string;
    gradeCardNo: string;
  },
  course: (typeof TEMPLATE_SAMPLE_COURSES)[number],
  rowIndex: number,
  semLabel: string,
  examMonth: string,
): (string | number)[] {
  const approxMarks = course.grade === "O" ? 95 : course.grade === "A+" ? 88 : course.grade === "A" ? 75 : 68;
  const isPractical = course.type === "PRACTICAL";
  return [
    student.slStart + rowIndex,
    student.email,
    student.name,
    student.dept,
    "Garden City University",
    "SCHOOL OF SCIENCES",
    student.programmeTitle,
    student.programmeCode,
    student.roll,
    examMonth,
    "2026-05-04",
    semLabel,
    student.gradeCardNo,
    "CORE COURSE",
    course.type,
    1,
    course.code,
    course.title,
    4,
    4,
    approxMarks * 0.4,
    approxMarks * 0.6,
    "PASS",
    course.grade,
    course.points,
  ];
}

/** One sample student × 1 semester × 8 courses (6 theory + 2 practical). COE may add unlimited rows. */
export function buildTejashviTemplateExampleRows(): (string | number)[][] {
  const student = {
    roll: "23BSFT101",
    email: "23bsft101@gcu.edu.in",
    name: "Abigail Albert Anbudurai",
    dept: "BSFT",
    programmeTitle: "Bachelor of Science Food Science and Technology",
    programmeCode: "BSFT",
    gradeCardNo: "GCBSFT00001",
    slStart: 1,
  };

  const semLabel = "I";
  const examMonth = "April - 2026";

  const rows: (string | number)[][] = [];
  TEMPLATE_SAMPLE_COURSES.forEach((course, courseIndex) => {
    rows.push(buildTemplateCourseRow(student, course, courseIndex, semLabel, examMonth));
  });
  return rows;
}
