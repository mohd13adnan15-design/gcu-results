import type { SupabaseClient } from "@supabase/supabase-js";

import type { Student } from "@/lib/types";

export type MarksheetCourse = {
  sl_no: number;
  section: string;
  course_code: string;
  course_title: string;
  course_priority?: number;
  course_credits: number;
  credits_earned: number;
  cia_max_marks_theory?: number;
  cia_max_marks_practical?: number;
  cia_marks_obtained_theory?: number;
  cia_marks_obtained_practical?: number;
  ese_max_marks_theory?: number;
  ese_max_marks_practical?: number;
  ese_marks_obtained_theory?: number;
  ese_marks_obtained_practical?: number;
  total_marks_theory?: number;
  total_marks_practical?: number;
  marks_obtained?: number;
  max_marks?: number;
  grade_obtained: string;
  grade_points: number;
};

export type StudentMarksheet = {
  id?: string;
  student_id: string;
  student_roll_no: string;
  university: string;
  school_name: string;
  programme_title: string;
  programme_code: string;
  student_name: string;
  registration_no: string;
  semester_label: string;
  exam_month_year: string;
  issue_date: string;
  grade_card_no: string;
  qr_data: string;
  photo_bucket: string | null;
  photo_path: string | null;
  total_credits: number;
  total_credits_earned: number;
  total_credit_points: number;
  sgpa: number;
  final_grade: string;
  courses: MarksheetCourse[];
};

export type MarksheetTotals = {
  totalCredits: number;
  totalCreditsEarned: number;
  totalCreditPoints: number;
  sgpa: number;
  finalGrade: string;
};

export type MarksheetCourseGroup = {
  section: string;
  courses: MarksheetCourse[];
};

export type MarksheetGradeScaleRow = {
  slNo: number;
  marksRange: string;
  letterGrade: string;
  gradePoints: string;
  description: string;
};

export type MarksheetCreditPointExample = {
  course: string;
  gradeObtained: string;
  gradePoints: string;
  courseCredits: string;
  creditPoints: string;
};

export type MarksheetCgpaSgpaRow = {
  slNo: number;
  range: string;
  letterGrade: string;
  description: string;
};

export const STUDENT_PHOTOS_BUCKET = "student-photos";

export const MARKSHEET_EXPLANATION_LINES = [
  "Semester Grade Point Average (SGPA) = Total Credit Points earned / Total Credits of the Semester",
  "Cumulative Grade Point Average (CGPA) = Total Credit Points earned / Total Credits of the programme",
  "Core Courses / Hard Core Courses / Soft Core Courses (CC / HC / SC): A course which should compulsorily be studied by a candidate as a core requirement.",
  "Ability Enhancement Compulsory Courses (AECC): A course designed to improve essential skills like communication and language proficiency.",
  "Skill Enhancement Courses (SEC): A course which is value-based and / or skill based and are aimed at providing hands-on training, competencies and skills etc.",
  "Open Elective Course / Discipline Specific Electives Course (OE / DSE): An elective course chosen generally from an unrelated discipline / subject, with an intention to seek exposure.",
  "Discipline Specific Core Courses (DSC): A course that serves as the foundation of a major or program, emphasizing essential knowledge and skills within the discipline.",
] as const;

export const MARKSHEET_GRADE_SCALE_ROWS: MarksheetGradeScaleRow[] = [
  {
    slNo: 1,
    marksRange: "100-90",
    letterGrade: "O",
    gradePoints: "10",
    description: "Outstanding",
  },
  { slNo: 2, marksRange: "89-80", letterGrade: "A+", gradePoints: "9", description: "Excellent" },
  { slNo: 3, marksRange: "79-70", letterGrade: "A", gradePoints: "8", description: "Very Good" },
  { slNo: 4, marksRange: "69-60", letterGrade: "B+", gradePoints: "7", description: "Good" },
  {
    slNo: 5,
    marksRange: "59-50",
    letterGrade: "B",
    gradePoints: "6",
    description: "Above Average",
  },
  { slNo: 6, marksRange: "49-40", letterGrade: "C", gradePoints: "5", description: "Average" },
  { slNo: 7, marksRange: "39-0", letterGrade: "RA", gradePoints: "-", description: "Re-appear" },
];

export const MARKSHEET_CREDIT_POINT_EXAMPLES: MarksheetCreditPointExample[] = [
  {
    course: "1",
    gradeObtained: "O",
    gradePoints: "10",
    courseCredits: "4",
    creditPoints: "4 x 10 = 40",
  },
  {
    course: "2",
    gradeObtained: "A+",
    gradePoints: "9",
    courseCredits: "4",
    creditPoints: "4 x 9 = 36",
  },
  {
    course: "3",
    gradeObtained: "A",
    gradePoints: "8",
    courseCredits: "4",
    creditPoints: "4 x 8 = 32",
  },
  {
    course: "4",
    gradeObtained: "B+",
    gradePoints: "7",
    courseCredits: "4",
    creditPoints: "4 x 7 = 28",
  },
  {
    course: "5",
    gradeObtained: "B",
    gradePoints: "6",
    courseCredits: "4",
    creditPoints: "4 x 6 = 24",
  },
  {
    course: "6",
    gradeObtained: "C",
    gradePoints: "5",
    courseCredits: "4",
    creditPoints: "4 x 5 = 20",
  },
  { course: "Total", gradeObtained: "", gradePoints: "", courseCredits: "24", creditPoints: "180" },
];

export const MARKSHEET_CGPA_SGPA_ROWS: MarksheetCgpaSgpaRow[] = [
  { slNo: 1, range: "9.00 - 10.00", letterGrade: "O", description: "Outstanding" },
  { slNo: 2, range: "8.00 - 8.99", letterGrade: "A+", description: "Excellent" },
  { slNo: 3, range: "7.00 - 7.99", letterGrade: "A", description: "Very Good" },
  { slNo: 4, range: "6.00 - 6.99", letterGrade: "B+", description: "Good" },
  { slNo: 5, range: "5.00 - 5.99", letterGrade: "B", description: "Above Average" },
  { slNo: 6, range: "4.00 - 4.99", letterGrade: "C", description: "Average" },
];

export const TEJASHVI_MARKSHEET_SEED: StudentMarksheet = {
  student_id: "",
  student_roll_no: "24btre152",
  university: "Garden City University",
  school_name: "SCHOOL OF ENGINEERING AND TECHNOLOGY",
  programme_title: "Bachelor of Technology in Robotics and Automation",
  programme_code: "BTRE",
  student_name: "V Sai Tejashvi",
  registration_no: "24BTRE152",
  semester_label: "4",
  exam_month_year: "April - 2026",
  issue_date: "2026-05-04",
  grade_card_no: "GCUBTRE152",
  qr_data: "GCU|24btre152|24BTRE152|V Sai Tejashvi|BTRE|Semester 4",
  photo_bucket: STUDENT_PHOTOS_BUCKET,
  photo_path: "24btre152/profile.jpeg",
  total_credits: 25,
  total_credits_earned: 25,
  total_credit_points: 209,
  sgpa: 8.36,
  final_grade: "A+",
  courses: [
    {
      sl_no: 1,
      section: "CORE COURSE",
      course_code: "24BTRE2411",
      course_title: "MATHEMATICS FOR ROBOTICS",
      course_credits: 4,
      credits_earned: 4,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 2,
      section: "CORE COURSE",
      course_code: "24BTRE2412",
      course_title: "DIGITAL ELECTRONICS AND MICROCONTROLLERS",
      course_credits: 4,
      credits_earned: 4,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 3,
      section: "CORE COURSE",
      course_code: "24BTRE2413",
      course_title: "ROBOT KINEMATICS AND DYNAMICS",
      course_credits: 3,
      credits_earned: 3,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 4,
      section: "PRACTICAL",
      course_code: "24BTREP2414",
      course_title: "MICROCONTROLLER PROGRAMMING LAB",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 5,
      section: "PRACTICAL",
      course_code: "24BTREP2415",
      course_title: "ROBOTICS SIMULATION LAB",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 6,
      section: "ABILITY ENHANCEMENT COMPULSORY COURSE",
      course_code: "24AAECC2416",
      course_title: "TECHNICAL ENGLISH AND COMMUNICATION",
      course_credits: 3,
      credits_earned: 3,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 7,
      section: "ABILITY ENHANCEMENT COMPULSORY COURSE",
      course_code: "24AAECC2417",
      course_title: "CONSTITUTION OF INDIA AND PROFESSIONAL ETHICS",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 8,
      section: "SKILL ENHANCEMENT COURSE",
      course_code: "24BTSEC2418",
      course_title: "PYTHON FOR AUTOMATION",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 9,
      section: "PRACTICAL",
      course_code: "24BTREP2419",
      course_title: "SENSOR INTERFACING LAB",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 10,
      section: "PRACTICAL",
      course_code: "24BTREP2420",
      course_title: "CAD AND 3D PRINTING PRACTICAL",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 11,
      section: "OPEN ELECTIVE COURSE",
      course_code: "24AOPEL2421",
      course_title: "ENVIRONMENTAL SUSTAINABILITY",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "C",
      grade_points: 5,
    },
  ],
};

/** Demo marksheet for 24btre148 - same shape as Tejashvi seed but different semester, courses, and totals. */
export const AARAV_MARKSHEET_SEED: StudentMarksheet = {
  student_id: "",
  student_roll_no: "24btre148",
  university: "Garden City University",
  school_name: "SCHOOL OF ENGINEERING AND TECHNOLOGY",
  programme_title: "Bachelor of Technology in Robotics and Automation",
  programme_code: "BTRE",
  student_name: "Aarav Sharma",
  registration_no: "24BTRE148",
  semester_label: "5",
  exam_month_year: "November - 2025",
  issue_date: "2026-05-04",
  grade_card_no: "GCUBTRE148",
  qr_data: "GCU|24btre148|24BTRE148|Aarav Sharma|BTRE|Semester 5",
  photo_bucket: STUDENT_PHOTOS_BUCKET,
  photo_path: "24btre148/profile.jpeg",
  total_credits: 25,
  total_credits_earned: 25,
  total_credit_points: 205,
  sgpa: 8.2,
  final_grade: "A+",
  courses: [
    {
      sl_no: 1,
      section: "CORE COURSE",
      course_code: "24BTRE3511",
      course_title: "INTRODUCTION TO AI FOR ROBOTICS",
      course_credits: 4,
      credits_earned: 4,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 2,
      section: "CORE COURSE",
      course_code: "24BTRE3512",
      course_title: "EMBEDDED SYSTEMS",
      course_credits: 4,
      credits_earned: 4,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 3,
      section: "CORE COURSE",
      course_code: "24BTRE3513",
      course_title: "INDUSTRIAL ROBOTICS",
      course_credits: 3,
      credits_earned: 3,
      grade_obtained: "B+",
      grade_points: 7,
    },
    {
      sl_no: 4,
      section: "PRACTICAL",
      course_code: "24BTREP3514",
      course_title: "ROBOT VISION LAB",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "O",
      grade_points: 10,
    },
    {
      sl_no: 5,
      section: "PRACTICAL",
      course_code: "24BTREP3515",
      course_title: "HYDRAULICS AND PNEUMATICS LAB",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 6,
      section: "ABILITY ENHANCEMENT COMPULSORY COURSE",
      course_code: "24AAECC3516",
      course_title: "BUSINESS COMMUNICATION",
      course_credits: 3,
      credits_earned: 3,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 7,
      section: "ABILITY ENHANCEMENT COMPULSORY COURSE",
      course_code: "24AAECC3517",
      course_title: "INDIAN KNOWLEDGE SYSTEM",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "B+",
      grade_points: 7,
    },
    {
      sl_no: 8,
      section: "SKILL ENHANCEMENT COURSE",
      course_code: "24BTSEC3518",
      course_title: "MACHINE LEARNING ESSENTIALS",
      course_credits: 2,
      credits_earned: 2,
      grade_obtained: "A",
      grade_points: 8,
    },
    {
      sl_no: 9,
      section: "PRACTICAL",
      course_code: "24BTREP3519",
      course_title: "DRIVES AND ACTUATORS LAB",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "A+",
      grade_points: 9,
    },
    {
      sl_no: 10,
      section: "PRACTICAL",
      course_code: "24BTREP3520",
      course_title: "VIRTUAL REALITY WORKSHOP",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "B",
      grade_points: 6,
    },
    {
      sl_no: 11,
      section: "OPEN ELECTIVE COURSE",
      course_code: "24AOPEL3521",
      course_title: "PRINCIPLES OF ECONOMICS",
      course_credits: 1,
      credits_earned: 1,
      grade_obtained: "A",
      grade_points: 8,
    },
  ],
};

export function calculateMarksheetTotals(courses: MarksheetCourse[]): MarksheetTotals {
  const totalCredits = courses.reduce((sum, course) => sum + Number(course.course_credits || 0), 0);
  const totalCreditsEarned = courses.reduce(
    (sum, course) => sum + Number(course.credits_earned || 0),
    0,
  );
  const totalCreditPoints = courses.reduce(
    (sum, course) => sum + Number(course.course_credits || 0) * Number(course.grade_points || 0),
    0,
  );
  const sgpa = totalCredits > 0 ? Number((totalCreditPoints / totalCredits).toFixed(2)) : 0;
  const finalGrade = courses.some((course) => course.grade_obtained.toUpperCase() === "RA")
    ? "RA"
    : gradeFromSgpa(sgpa);

  return {
    totalCredits,
    totalCreditsEarned,
    totalCreditPoints,
    sgpa,
    finalGrade,
  };
}

export function isPracticalCourse(course: { course_title: string; section?: string; course_code?: string }): boolean {
  const title = (course.course_title || "").toUpperCase().trim();
  const section = (course.section || "").toUpperCase().trim();
  if (section.includes("PRACTICAL")) return true;
  if (
    title.endsWith("(P)") ||
    title.includes("(P)") ||
    title.includes("PRACTICAL") ||
    title.endsWith(" LAB") ||
    title.includes(" LAB ")
  ) return true;
  return false;
}

export function groupCoursesBySection(courses: MarksheetCourse[]): MarksheetCourseGroup[] {
  return [...courses]
    .sort((a, b) => a.sl_no - b.sl_no)
    .reduce<MarksheetCourseGroup[]>((groups, course) => {
      const isPractical = isPracticalCourse(course);
      const effectiveSection = isPractical ? "PRACTICAL" : course.section;
      const previous = groups.at(-1);
      
      if (previous?.section === effectiveSection) {
        previous.courses.push(course);
      } else {
        groups.push({ section: effectiveSection, courses: [course] });
      }
      return groups;
    }, []);
}

export function buildMarksheetFileName(marksheet: StudentMarksheet, extension: "pdf") {
  const semMatch = marksheet.semester_label.match(/\d+/);
  const semNum = semMatch ? semMatch[0] : marksheet.semester_label;
  return `GradeCard_Sem${semNum}.${extension}`;
}

export function getStudentPhotoPublicUrl(
  supabase: SupabaseClient,
  marksheet: Pick<StudentMarksheet, "photo_bucket" | "photo_path">,
) {
  const photoPath = normalizeStoragePath(marksheet.photo_path);
  if (!marksheet.photo_bucket || !photoPath) return null;
  return supabase.storage.from(marksheet.photo_bucket).getPublicUrl(photoPath).data.publicUrl;
}

export async function resolveStudentPhotoUrl(
  supabase: SupabaseClient,
  marksheet: Pick<StudentMarksheet, "photo_bucket" | "photo_path" | "student_roll_no">,
) {
  const roll = marksheet.student_roll_no?.toLowerCase();
  if (roll === "24btre152") return "/templates/assets/v_sai_tejashvi_profile.jpeg";
  if (roll === "23bsft101") return "/templates/assets/abigail_profile.jpeg";
  if (roll === "23msda105" || roll === "23msda105@gcu.edu.in") {
    return "/templates/assets/princy akka.jpeg";
  }

  // 1. Check students table first
  if (marksheet.student_roll_no) {
    try {
      const { data: student } = await supabase
        .from("students")
        .select("image_path")
        .eq("student_id", marksheet.student_roll_no)
        .maybeSingle();

      if (student?.image_path) {
        return supabase.storage.from("student-photos").getPublicUrl(student.image_path).data.publicUrl;
      }
    } catch (e) {
      console.error("Failed to query student photo:", e);
    }
  }

  // 2. Fallback to configured photo bucket and path list
  if (marksheet.photo_bucket) {
    const configuredPath = normalizeStoragePath(marksheet.photo_path);

    const candidates = await listStudentPhotoCandidates(
      supabase,
      marksheet.photo_bucket,
      marksheet.student_roll_no,
      configuredPath,
    );

    const resolvedPath = pickStudentPhotoPath({
      configuredPath,
      rollNo: marksheet.student_roll_no,
      candidates,
    });

    if (resolvedPath) {
      return supabase.storage.from(marksheet.photo_bucket).getPublicUrl(resolvedPath).data.publicUrl;
    }
  }

  // 3. Absolute fallback to default-avatar
  return "/templates/assets/default-avatar.png";
}

export function pickStudentPhotoPath({
  configuredPath,
  rollNo,
  candidates,
}: {
  configuredPath?: string | null;
  rollNo: string;
  candidates: string[];
}) {
  const configured = normalizeStoragePath(configuredPath);
  const imageCandidates = candidates
    .map(normalizeStoragePath)
    .filter(isPresent)
    .filter(isImagePath);
  if (configured && imageCandidates.includes(configured)) return configured;

  const configuredFolder = configured ? folderName(configured) : "";
  const configuredBase = configured ? baseNameWithoutExtension(configured) : "";
  const rollFolder = rollNo.toLowerCase();
  const preferredFolder = configuredFolder || rollFolder;

  return (
    imageCandidates.find(
      (candidate) =>
        folderName(candidate).toLowerCase() === preferredFolder.toLowerCase() &&
        baseNameWithoutExtension(candidate).toLowerCase() === configuredBase.toLowerCase(),
    ) ??
    imageCandidates.find(
      (candidate) =>
        folderName(candidate).toLowerCase() === preferredFolder.toLowerCase() &&
        baseNameWithoutExtension(candidate).toLowerCase() === "profile",
    ) ??
    imageCandidates.find((candidate) => candidate.toLowerCase().includes(rollFolder)) ??
    imageCandidates.find(
      (candidate) => folderName(candidate).toLowerCase() === preferredFolder.toLowerCase(),
    ) ??
    imageCandidates[0] ??
    null
  );
}

/** Rows from `student_marks` / Excel pipeline - shape matches Supabase insert. */
export type LegacyMarkRow = {
  subject: string;
  subject_code: string;
  course_category?: string | null;
  course_priority?: number | null;
  credits?: number | null;
  credits_earned?: number | null;
  cia_max_marks_theory?: number | null;
  cia_max_marks_practical?: number | null;
  cia_marks_obtained_theory?: number | null;
  cia_marks_obtained_practical?: number | null;
  ese_max_marks_theory?: number | null;
  ese_max_marks_practical?: number | null;
  ese_marks_obtained_theory?: number | null;
  ese_marks_obtained_practical?: number | null;
  total_marks_theory?: number | null;
  total_marks_practical?: number | null;
  marks_obtained?: number | null;
  max_marks?: number | null;
  grade?: string | null;
  grade_points?: number | null;
};

/** Same mapping used for PDF JSON (`courses` on `student_marksheets`) and sync. */
export function legacyMarkRowsToMarksheetCourses(marks: LegacyMarkRow[]): MarksheetCourse[] {
  return marks.map((m, index) => {
    const section = String(m.course_category ?? "CORE COURSE").trim() || "CORE COURSE";
    const max_marks = section.toUpperCase().includes("PRACTICAL") ? 50 : (Number(m.max_marks) || 100);
    return {
      sl_no: index + 1,
      section,
      course_code: String(m.subject_code ?? "").trim(),
      course_title: String(m.subject ?? "").trim(),
      course_priority: Number(m.course_priority ?? 1) || 1,
      course_credits: Number(m.credits ?? 0) || 0,
      credits_earned: Number(m.credits_earned ?? 0) || 0,
      cia_max_marks_theory: Number(m.cia_max_marks_theory ?? 0) || 0,
      cia_max_marks_practical: Number(m.cia_max_marks_practical ?? 0) || 0,
      cia_marks_obtained_theory: Number(m.cia_marks_obtained_theory ?? 0) || 0,
      cia_marks_obtained_practical: Number(m.cia_marks_obtained_practical ?? 0) || 0,
      ese_max_marks_theory: Number(m.ese_max_marks_theory ?? 0) || 0,
      ese_max_marks_practical: Number(m.ese_max_marks_practical ?? 0) || 0,
      ese_marks_obtained_theory: Number(m.ese_marks_obtained_theory ?? 0) || 0,
      ese_marks_obtained_practical: Number(m.ese_marks_obtained_practical ?? 0) || 0,
      total_marks_theory: Number(m.total_marks_theory ?? 0) || 0,
      total_marks_practical: Number(m.total_marks_practical ?? 0) || 0,
      marks_obtained: Number(m.marks_obtained ?? 0) || 0,
      max_marks,
      grade_obtained: String(m.grade ?? "").trim(),
      grade_points: Number(m.grade_points ?? 0) || 0,
    };
  });
}

/** Insert payloads for `student_marks` from saved marksheet JSON (inverse of legacy rows → courses). */
export function marksheetCoursesToStudentMarkInserts(
  studentId: string,
  courses: MarksheetCourse[],
  semesterLabel?: string,
): any[] {
  return courses.map((c) => {
    const isPractical = String(c.section).toUpperCase().includes("PRACTICAL");
    const max_marks = isPractical ? 50 : (c.max_marks ?? 100);
    return {
      student_id: studentId,
      course_category: c.section,
      subject: c.course_title,
      subject_code: c.course_code,
      course_priority: c.course_priority ?? 1,
      credits: c.course_credits,
      credits_earned: c.credits_earned,
      cia_max_marks_theory: c.cia_max_marks_theory ?? 0,
      cia_max_marks_practical: c.cia_max_marks_practical ?? 0,
      cia_marks_obtained_theory: c.cia_marks_obtained_theory ?? 0,
      cia_marks_obtained_practical: c.cia_marks_obtained_practical ?? 0,
      ese_max_marks_theory: c.ese_max_marks_theory ?? 0,
      ese_max_marks_practical: c.ese_max_marks_practical ?? 0,
      ese_marks_obtained_theory: c.ese_marks_obtained_theory ?? 0,
      ese_marks_obtained_practical: c.ese_marks_obtained_practical ?? 0,
      total_marks_theory: c.total_marks_theory ?? 0,
      total_marks_practical: c.total_marks_practical ?? 0,
      marks_obtained: c.marks_obtained ?? 0,
      max_marks,
      grade: c.grade_obtained || "RA",
      grade_points: c.grade_points,
      semester_label: semesterLabel || null,
    };
  });
}

/** Build a marksheet view from `grade_card_details` + `student_marks` when `student_marksheets` is empty. */
export function studentMarksToMarksheet(
  student: Student,
  header: Record<string, unknown> | null,
  marks: LegacyMarkRow[],
): StudentMarksheet | null {
  if (marks.length === 0) return null;

  const courses = legacyMarkRowsToMarksheetCourses(marks);

  const totals = calculateMarksheetTotals(courses);
  const programmeTitle = text(header?.programme_title) || "-";
  const programmeCode = text(header?.programme_code) || "-";
  const studentName = text(header?.student_name) || student.full_name;
  const registrationNo = text(header?.registration_no) || student.student_id;
  const semesterLabel = text(header?.semester_label) || `Semester ${student.semester}`;
  const examMonthYear = text(header?.exam_month_year);
  const issueDate = student.grade_card_issue_date ? text(student.grade_card_issue_date) : text(header?.issue_date);
  const sgpa =
    header?.semester_gpa != null && Number.isFinite(Number(header.semester_gpa))
      ? Number(header.semester_gpa)
      : totals.sgpa;
  const finalGrade = text(header?.final_grade) || totals.finalGrade;

  return {
    student_id: student.id,
    student_roll_no: student.student_id,
    university: "Garden City University",
    school_name: "SCHOOL OF ENGINEERING AND TECHNOLOGY",
    programme_title: programmeTitle,
    programme_code: programmeCode,
    student_name: studentName,
    registration_no: registrationNo,
    semester_label: semesterLabel,
    exam_month_year: examMonthYear,
    issue_date: issueDate,
    grade_card_no: "",
    qr_data: `${student.student_id}|${student.email}|grade-data`,
    photo_bucket: null,
    photo_path: null,
    total_credits: totals.totalCredits,
    total_credits_earned: totals.totalCreditsEarned,
    total_credit_points: totals.totalCreditPoints,
    sgpa,
    final_grade: finalGrade || totals.finalGrade,
    courses,
  };
}

export async function fetchStudentMarksheet(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase
    .from("student_marksheets")
    .select("*")
    .eq("student_id", studentId)
    .order("semester_label", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeMarksheet(data);

  const [
    { data: studentData, error: studentError },
    { data: headerData, error: headerError },
    { data: marksData, error: marksError },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
    supabase.from("grade_card_details").select("*").eq("student_id", studentId).maybeSingle(),
    supabase
      .from("student_marks")
      .select(
        "subject,subject_code,course_category,course_priority,credits,credits_earned,cia_max_marks_theory,cia_max_marks_practical,cia_marks_obtained_theory,cia_marks_obtained_practical,ese_max_marks_theory,ese_max_marks_practical,ese_marks_obtained_theory,ese_marks_obtained_practical,total_marks_theory,total_marks_practical,marks_obtained,max_marks,grade,grade_points,semester_label",
      )
      .eq("student_id", studentId)
      .order("course_priority", { ascending: true })
      .order("subject_code", { ascending: true }),
  ]);

  if (studentError) throw studentError;
  if (headerError) throw headerError;
  if (marksError) throw marksError;

  const student = studentData as Student | null;
  if (!student) return null;

  const header = (headerData as Record<string, unknown> | null) ?? null;
  const targetSemLabel = header?.semester_label || `Semester ${student.semester || 1}`;

  let marks = ((marksData as any[]) ?? []).filter(Boolean);
  const hasSemMarks = marks.some((m) => m.semester_label === targetSemLabel);
  if (hasSemMarks) {
    marks = marks.filter((m) => m.semester_label === targetSemLabel);
  }

  return studentMarksToMarksheet(
    student,
    header,
    marks,
  );
}

export async function fetchAllStudentMarksheets(supabase: SupabaseClient, studentId: string) {
  // Try to fetch all saved marksheets for this student
  const { data, error } = await supabase
    .from("student_marksheets")
    .select("*")
    .eq("student_id", studentId)
    .order("semester_label", { ascending: true });

  if (error && error.code !== "PGRST116") throw error; // Ignore not found if it's returning empty array anyway

  if (data && data.length > 0) {
    return data.map(normalizeMarksheet);
  }

  // Fallback: If no saved marksheets exist, construct semester-specific marksheets from student_marks table
  const [
    { data: studentData, error: studentError },
    { data: headerData, error: headerError },
    { data: marksData, error: marksError },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
    supabase.from("grade_card_details").select("*").eq("student_id", studentId).maybeSingle(),
    supabase
      .from("student_marks")
      .select(
        "subject,subject_code,course_category,course_priority,credits,credits_earned,cia_max_marks_theory,cia_max_marks_practical,cia_marks_obtained_theory,cia_marks_obtained_practical,ese_max_marks_theory,ese_max_marks_practical,ese_marks_obtained_theory,ese_marks_obtained_practical,total_marks_theory,total_marks_practical,marks_obtained,max_marks,grade,grade_points,semester_label",
      )
      .eq("student_id", studentId)
      .order("course_priority", { ascending: true })
      .order("subject_code", { ascending: true }),
  ]);

  if (studentError || marksError) return [];
  const student = studentData as Student | null;
  if (!student) return [];

  const marks = ((marksData as any[]) ?? []).filter(Boolean);
  if (marks.length === 0) return [];

  // Group marks by semester_label
  const semGroups = new Map<string, any[]>();
  marks.forEach((m) => {
    const label = m.semester_label || `Semester ${student.semester || 1}`;
    if (!semGroups.has(label)) {
      semGroups.set(label, []);
    }
    semGroups.get(label)!.push(m);
  });

  const marksheets: StudentMarksheet[] = [];
  
  // Sort the semester labels naturally if possible
  const sortedLabels = Array.from(semGroups.keys()).sort((a, b) => {
    const aMatch = a.match(/\d+/);
    const bMatch = b.match(/\d+/);
    if (aMatch && bMatch) {
      return Number(aMatch[0]) - Number(bMatch[0]);
    }
    return a.localeCompare(b);
  });

  for (const label of sortedLabels) {
    const groupMarks = semGroups.get(label)!;
    // Create header override with semester label
    const headerCopy = headerData ? { ...(headerData as any), semester_label: label } : { semester_label: label };
    const sheet = studentMarksToMarksheet(student, headerCopy, groupMarks);
    if (sheet) {
      marksheets.push(sheet);
    }
  }

  return marksheets;
}

export async function fetchMarksheetByRegistrationNo(
  supabase: SupabaseClient,
  registrationNo: string,
) {
  const normalized = String(registrationNo ?? "").trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("student_marksheets")
    .select("*")
    .ilike("registration_no", normalized)
    .order("semester_label", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeMarksheet(data);
}

export function normalizeMarksheet(row: Record<string, unknown>): StudentMarksheet {
  const courses = Array.isArray(row.courses)
    ? row.courses.map((course) => normalizeCourse(course as Record<string, unknown>))
    : [];
  const totals = calculateMarksheetTotals(courses);

  return {
    id: textOrUndefined(row.id),
    student_id: text(row.student_id),
    student_roll_no: text(row.student_roll_no),
    university: text(row.university),
    school_name: text(row.school_name),
    programme_title: text(row.programme_title),
    programme_code: text(row.programme_code),
    student_name: text(row.student_name),
    registration_no: text(row.registration_no),
    semester_label: text(row.semester_label),
    exam_month_year: text(row.exam_month_year),
    issue_date: text(row.issue_date),
    grade_card_no: text(row.grade_card_no),
    qr_data: text(row.qr_data),
    photo_bucket: nullableText(row.photo_bucket),
    photo_path: nullableText(row.photo_path),
    total_credits: numberOr(row.total_credits, totals.totalCredits),
    total_credits_earned: numberOr(row.total_credits_earned, totals.totalCreditsEarned),
    total_credit_points: numberOr(row.total_credit_points, totals.totalCreditPoints),
    sgpa: numberOr(row.sgpa, totals.sgpa),
    final_grade: text(row.final_grade || totals.finalGrade),
    courses,
  };
}

function normalizeCourse(course: Record<string, unknown>): MarksheetCourse {
  const section = text(course.section);
  const max_marksRaw = numberOr(course.max_marks, 0);
  const max_marks = section.toUpperCase().includes("PRACTICAL") ? 50 : (max_marksRaw || 100);
  return {
    sl_no: numberOr(course.sl_no, 0),
    section,
    course_code: text(course.course_code),
    course_title: text(course.course_title),
    course_priority: numberOr(course.course_priority, 1),
    course_credits: numberOr(course.course_credits, 0),
    credits_earned: numberOr(course.credits_earned, 0),
    cia_max_marks_theory: numberOr(course.cia_max_marks_theory, 0),
    cia_max_marks_practical: numberOr(course.cia_max_marks_practical, 0),
    cia_marks_obtained_theory: numberOr(course.cia_marks_obtained_theory, 0),
    cia_marks_obtained_practical: numberOr(course.cia_marks_obtained_practical, 0),
    ese_max_marks_theory: numberOr(course.ese_max_marks_theory, 0),
    ese_max_marks_practical: numberOr(course.ese_max_marks_practical, 0),
    ese_marks_obtained_theory: numberOr(course.ese_marks_obtained_theory, 0),
    ese_marks_obtained_practical: numberOr(course.ese_marks_obtained_practical, 0),
    total_marks_theory: numberOr(course.total_marks_theory, 0),
    total_marks_practical: numberOr(course.total_marks_practical, 0),
    marks_obtained: numberOr(course.marks_obtained, 0),
    max_marks,
    grade_obtained: text(course.grade_obtained),
    grade_points: numberOr(course.grade_points, 0),
  };
}

function gradeFromSgpa(sgpa: number) {
  if (sgpa >= 9) return "O";
  if (sgpa >= 8) return "A+";
  if (sgpa >= 7) return "A";
  if (sgpa >= 6) return "B+";
  if (sgpa >= 5) return "B";
  if (sgpa >= 4) return "C";
  return "RA";
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function textOrUndefined(value: unknown) {
  const next = text(value);
  return next || undefined;
}

function nullableText(value: unknown) {
  const next = text(value);
  return next || null;
}

function numberOr(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

async function listStudentPhotoCandidates(
  supabase: SupabaseClient,
  bucket: string,
  rollNo: string,
  configuredPath: string | null,
) {
  const prefixes = new Set(["", rollNo.toLowerCase()]);
  const configuredFolder = configuredPath ? folderName(configuredPath) : "";
  if (configuredFolder) prefixes.add(configuredFolder);

  const candidates = new Set<string>();
  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) continue;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (isImagePath(path)) candidates.add(path);
    }
  }

  return [...candidates];
}



function normalizeStoragePath(value: string | null | undefined) {
  const path = text(value).replace(/^\/+/, "").replace(/\\/g, "/");
  return path || null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isImagePath(path: string) {
  return /\.(jpe?g|png|webp)$/i.test(path);
}

function folderName(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function baseNameWithoutExtension(path: string) {
  const name = path.split("/").at(-1) ?? path;
  return name.replace(/\.[^.]+$/, "");
}
