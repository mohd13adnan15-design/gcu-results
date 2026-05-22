import { TEJASHVI_MARKSHEET_SEED } from "@/lib/marksheet";

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
  cia_marks_obtained_theory: number;
  cia_marks_obtained_practical: number;
  ese_max_marks_theory: number;
  ese_max_marks_practical: number;
  ese_marks_obtained_theory: number;
  ese_marks_obtained_practical: number;
  total_marks_theory: number;
  total_marks_practical: number;
  marks_obtained: number;
  max_marks: number;
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

/** Parse one normalized row into structured fields (same logic as legacy strict template, with extra header fields). */
export function parseMarksTemplateRow(nc: Record<string, unknown>): ParsedMarksCourseRow | null {
  const student_id = cell(nc, "Student ID", "student id", "registration no", "registrationno", "reg no");
  const email = cell(nc, "Email", "email").toLowerCase();
  const full_name = cell(nc, "Student Name", "student name");
  const subject_code = cell(nc, "Course Code", "course code");
  const subject = cell(nc, "Course Title", "course title");
  const image_path = cell(nc, "Image Path", "image path", "image_path");

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

  const cia_max_raw = cellNum(nc, "cia max marks theory", "ciamaxmarkstheory") || cellNum(nc, "cia max marks practical", "ciamaxmarkspractical") || cellNum(nc, "CIA Max Marks", "ciamaxmarks") || 0;
  const cia_obt_raw = cellNum(nc, "cia marks obtained theory", "ciamarksobtainedtheory") || cellNum(nc, "cia marks obtained practical", "ciamarksobtainedpractical") || cellNum(nc, "CIA Marks Obtained", "ciamarksobtained") || 0;
  const ese_max_raw = cellNum(nc, "ese max marks theory", "esemaxmarkstheory") || cellNum(nc, "ese max marks practical", "esemaxmarkspractical") || cellNum(nc, "ESE Max Marks", "esemaxmarks") || 0;
  const ese_obt_raw = cellNum(nc, "ese marks obtained theory", "esemarksobtainedtheory") || cellNum(nc, "ese marks obtained practical", "esemarksobtainedpractical") || cellNum(nc, "ESE Marks Obtained", "esemarksobtained") || 0;

  const cia_max_marks_theory = isPractical ? 0 : cia_max_raw;
  const cia_max_marks_practical = isPractical ? cia_max_raw : 0;
  const cia_marks_obtained_theory = isPractical ? 0 : cia_obt_raw;
  const cia_marks_obtained_practical = isPractical ? cia_obt_raw : 0;
  const ese_max_marks_theory = isPractical ? 0 : ese_max_raw;
  const ese_max_marks_practical = isPractical ? ese_max_raw : 0;
  const ese_marks_obtained_theory = isPractical ? 0 : ese_obt_raw;
  const ese_marks_obtained_practical = isPractical ? ese_obt_raw : 0;

  const total_marks_theory_raw = cellNum(nc, "total marks theory", "totalmarkstheory") || 0;
  const total_marks_practical_raw = cellNum(nc, "total marks practical", "totalmarkspractical") || 0;
  const total_marks_theory = isPractical ? 0 : (total_marks_theory_raw || (cia_max_marks_theory + ese_max_marks_theory));
  const total_marks_practical = isPractical ? (total_marks_practical_raw || (cia_max_marks_practical + ese_max_marks_practical)) : 0;

  const max_marksRaw = Number(cell(nc, "Max Marks", "max marks", "total max marks", "totalmaxmarks"));
  const max_marks = isPractical ? 50 : (max_marksRaw || (cia_max_raw + ese_max_raw) || 100);

  const marks_obtained = cia_obt_raw + ese_obt_raw;

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
    course_priority,
    credits,
    credits_earned,
    cia_max_marks_theory,
    cia_max_marks_practical,
    cia_marks_obtained_theory,
    cia_marks_obtained_practical,
    ese_max_marks_theory,
    ese_max_marks_practical,
    ese_marks_obtained_theory,
    ese_marks_obtained_practical,
    total_marks_theory,
    total_marks_practical,
    marks_obtained: Number.isFinite(marks_obtained) ? marks_obtained : 0,
    max_marks,
    grade,
    grade_points,
    image_path: image_path || undefined,
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
  if (!hasId) missing.push("Student ID / Registration No");
  if (!hasName) missing.push("Student Name");
  if (!hasCode) missing.push("Course Code");
  if (!hasTitle) missing.push("Course Title");

  if (missing.length > 0) {
    throw new Error(
      `Missing critical columns: ${missing.join(", ")}. Please ensure your Excel has these fields.`
    );
  }
}

export function buildTejashviTemplateExampleRows(): (string | number)[][] {
  const m = TEJASHVI_MARKSHEET_SEED;
  const roll = m.student_roll_no;
  const email = `${roll.toLowerCase()}@gcu.edu.in`;

  // Helper to map a course to an excel row
  const mapCourse = (c: any, index: number, semLabel: string, examMonth: string) => {
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
      toRoman(parseInt(semLabel.replace(/\D/g, "") || "1", 10)),
      1,
      m.university,
      m.school_name,
      m.programme_title,
      m.programme_code,
      m.registration_no,
      examMonth,
      m.issue_date,
      semLabel,
      m.grade_card_no,
      c.section,
      1, // Priority
      c.course_code,
      c.course_title,
      c.course_credits,
      c.credits_earned,
      40, // CIA Max Theory
      0, // CIA Max Practical
      approxMarks * 0.4, // CIA Obtained Theory
      0, // CIA Obtained Practical
      60, // ESE Max Theory
      0, // ESE Max Practical
      approxMarks * 0.6, // ESE Obtained Theory
      0, // ESE Obtained Practical
      100, // Total Max Theory
      0, // Total Max Practical
      c.grade_obtained,
      c.grade_points,
    ];
  };

  // Generate Semester 4 rows
  const sem4Rows = m.courses.map((c, index) => mapCourse(c, index, "4", "April - 2026"));

  // Generate Semester 5 rows (just duplicate with different codes and semester label for example)
  const sem5Rows = m.courses.slice(0, 5).map((c, index) =>
    mapCourse({ ...c, course_code: c.course_code.replace("241", "351"), grade_obtained: "O", grade_points: 10 }, index, "5", "December - 2026")
  );

  return [...sem4Rows, ...sem5Rows];
}
