const XLSX = require("xlsx");
const path = require("path");

const headers = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Max Marks Theory", "CIA Max Marks Practical", "CIA Min Marks Theory", "CIA Min Marks Practical",
  "CIA Marks Obtained Theory", "CIA Marks Obtained Practical",
  "ESE Max Marks Theory", "ESE Max Marks Practical", "ESE Min Marks Theory", "ESE Min Marks Practical",
  "ESE Marks Obtained Theory", "ESE Marks Obtained Practical",
  "Total Marks Theory", "Total Marks Practical", "Status", "Grade Obtained", "Grade Points",
];

const courses = [
  { code: "SUB101", title: "Introduction to Subject One", type: "THEORY", grade: "A", points: 8 },
  { code: "SUB102", title: "Introduction to Subject Two", type: "THEORY", grade: "A+", points: 9 },
  { code: "SUB103P", title: "Practical Lab One", type: "PRACTICAL", grade: "O", points: 10 },
  { code: "SUB104", title: "Advanced Subject Four", type: "THEORY", grade: "B+", points: 7 },
];

function courseRow(sl, student, course, semLabel, examMonth) {
  const approx = course.grade === "O" ? 95 : course.grade === "A+" ? 88 : course.grade === "A" ? 75 : 68;
  const practical = course.type === "PRACTICAL";
  return [
    sl,
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
    practical ? 0 : 40,
    practical ? 40 : 0,
    practical ? 0 : 16,
    practical ? 16 : 0,
    practical ? 0 : approx * 0.4,
    practical ? approx * 0.4 : 0,
    practical ? 0 : 60,
    practical ? 60 : 0,
    practical ? 0 : 24,
    practical ? 24 : 0,
    practical ? 0 : approx * 0.6,
    practical ? approx * 0.6 : 0,
    100,
    0,
    "PASS",
    course.grade,
    course.points,
  ];
}

const students = [
  {
    roll: "23BSFT101",
    email: "23bsft101@gcu.edu.in",
    name: "Abigail Albert Anbudurai",
    dept: "BSFT",
    programmeTitle: "Bachelor of Science Food Science and Technology",
    programmeCode: "BSFT",
    gradeCardNo: "GCBSFT00001",
  },
  {
    roll: "23BSFT102",
    email: "23bsft102@gcu.edu.in",
    name: "Rahul Krishnan",
    dept: "BSFT",
    programmeTitle: "Bachelor of Science Food Science and Technology",
    programmeCode: "BSFT",
    gradeCardNo: "GCBSFT00002",
  },
];

const exampleRows = [];
let sl = 1;
for (const student of students) {
  for (const [semLabel, examMonth] of [
    ["IV", "April - 2026"],
    ["V", "December - 2026"],
  ]) {
    for (const course of courses) {
      exampleRows.push(courseRow(sl++, student, course, semLabel, examMonth));
    }
  }
}

const targets = [
  path.join(__dirname, "../public/marks_template_final.xlsx"),
  path.join(__dirname, "../src/routes/marks_template_final.xlsx"),
];

for (const filePath of targets) {
  try {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
    XLSX.writeFile(wb, filePath);
    console.log("Updated template:", filePath, `(${exampleRows.length} sample rows)`);
  } catch (error) {
    console.warn("Skipped template path:", filePath, error.message);
  }
}
