import { TEJASHVI_MARKSHEET_SEED } from "@/lib/marksheet";

/** Full template — one row per course; repeat student/header columns on every row (same as typical Excel marks uploads). */
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
  credits: number;
  credits_earned: number;
  marks_obtained: number;
  max_marks: number;
  grade: string;
  grade_points: number;
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

/** Parse one normalized row into structured fields (same logic as legacy strict template, with extra header fields). */
export function parseMarksTemplateRow(nc: Record<string, unknown>): ParsedMarksCourseRow | null {
  const student_id = cell(nc, "Student ID", "student id");
  const email = cell(nc, "Email", "email").toLowerCase();
  const full_name = cell(nc, "Student Name", "student name");
  const subject_code = cell(nc, "Course Code", "course code");
  const subject = cell(nc, "Course Title", "course title");

  if (!student_id || !email || !full_name || !subject_code || !subject) {
    return null;
  }

  const slRaw = cellNum(nc, "Sl No", "sl no", "serial");
  const sl_no = Number.isFinite(slRaw) ? slRaw : 0;

  const department = cell(nc, "Department", "department") || "CSE";
  const semester = Number(cell(nc, "Semester", "semester")) || 1;
  const year = Number(cell(nc, "Year", "year")) || 1;
  const university = cell(nc, "University", "university") || "Garden City University";
  const school_name =
    cell(nc, "School Name", "school name") || "SCHOOL OF ENGINEERING AND TECHNOLOGY";
  const programme_title = cell(nc, "Programme Title", "programme title");
  const programme_code = cell(nc, "Programme Code", "programme code");
  const registration_no = cell(nc, "Registration No", "registration no");
  const exam_month_year = cell(nc, "Exam Month & Year", "exam month & year");
  const issue_date = cell(nc, "Issue Date", "issue date");
  const semester_label = cell(nc, "Semester Label", "semester label");
  const grade_card_no = cell(nc, "Grade Card No", "grade card no");

  const course_category = cell(nc, "Course Category", "course category") || "CORE COURSE";
  const credits = Number(cell(nc, "Course Credits", "course credits")) || 0;
  const marksStr = cell(nc, "Marks Obtained", "marks obtained");
  const max_marks = Number(cell(nc, "Max Marks", "max marks")) || 100;
  const marks_obtained = marksStr === "" ? NaN : Number(marksStr);
  const gradeRaw = cell(nc, "Grade Obtained", "grade obtained", "Grade").toUpperCase();
  const grade =
    gradeRaw ||
    (Number.isFinite(marks_obtained) ? autoGradeFromPct(marks_obtained, max_marks) : "RA");
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
    credits,
    credits_earned,
    marks_obtained: Number.isFinite(marks_obtained) ? marks_obtained : 0,
    max_marks,
    grade,
    grade_points,
  };
}

/** Ensure the uploaded sheet has the required column headers (lenient check). */
export function validateMarksTemplateColumns(sampleRow: Record<string, unknown>): void {
  const keys = new Set(Object.keys(sampleRow).map(normalizeExcelHeaderKey));
  
  // Critical column sets (must have at least one from each) - Pre-normalized
  const idAliases = ["studentid", "rollno", "rollnumber", "regno", "registrationno", "id"];
  const nameAliases = ["studentname", "name", "fullname", "candidatename"];
  const codeAliases = ["coursecode", "subjectcode", "code", "subcode"];
  const titleAliases = ["coursetitle", "subject", "subjectname", "coursename"];

  const hasId = idAliases.some(a => keys.has(a));
  const hasName = nameAliases.some(a => keys.has(a));
  const hasCode = codeAliases.some(a => keys.has(a));
  const hasTitle = titleAliases.some(a => keys.has(a));

  const missing = [];
  if (!hasId) missing.push("Student ID / Roll No");
  if (!hasName) missing.push("Student Name");
  if (!hasCode) missing.push("Course Code");
  if (!hasTitle) missing.push("Course Title");

  if (missing.length > 0) {
    throw new Error(
      `Missing critical columns: ${missing.join(", ")}. Please ensure your Excel has these fields.`
    );
  }
}

/** Build 11 example rows from the Tejashvi (24btre152) reference marksheet for the downloadable template. */
export function buildTejashviTemplateExampleRows(): (string | number)[][] {
  const m = TEJASHVI_MARKSHEET_SEED;
  const roll = m.student_roll_no;
  const email = `${roll.toLowerCase()}@gcu.edu.in`;

  return m.courses.map((c, index) => {
    const approxMarks =
      c.grade_obtained === "O"
        ? 95
        : c.grade_obtained === "A+"
          ? 88
          : c.grade_obtained === "A"
            ? 75
            : c.grade_obtained === "C"
              ? 45
              : 55;
    return [
      index + 1,
      roll,
      email,
      "student123",
      m.student_name,
      "SET",
      4,
      1,
      m.university,
      m.school_name,
      m.programme_title,
      m.programme_code,
      m.registration_no,
      m.exam_month_year,
      m.issue_date,
      m.semester_label,
      m.grade_card_no,
      c.section,
      c.course_code,
      c.course_title,
      c.course_credits,
      c.credits_earned,
      approxMarks,
      100,
      c.grade_obtained,
      c.grade_points,
    ];
  });
}
