const XLSX = require("xlsx");
const path = require("path");

const headers = [
  "Sl No", "Email", "Student Name", "Department", "University", "School Name",
  "Programme Title", "Programme Code", "Registration No", "Exam Month & Year",
  "Issue Date", "Semester Label", "Grade Card No", "Course Category", "Course Type",
  "Course Priority", "Course Code", "Course Title", "Course Credits", "Credits Earned",
  "CIA Obtained", "ESE Obtained",
  "Status", "Grade Obtained", "Grade Points",
];

const courses = [
  { code: "SUB101", title: "Introduction to Subject One", type: "THEORY", grade: "A", points: 8 },
  { code: "SUB102", title: "Introduction to Subject Two", type: "THEORY", grade: "A+", points: 9 },
  { code: "SUB103P", title: "Practical Lab One", type: "PRACTICAL", grade: "O", points: 10 },
  { code: "SUB104", title: "Advanced Subject Four", type: "THEORY", grade: "B+", points: 7 },
];

function courseRow(sl, student, course, semLabel, examMonth) {
  const approx = course.grade === "O" ? 95 : course.grade === "A+" ? 88 : course.grade === "A" ? 75 : 68;
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
    approx * 0.4,
    approx * 0.6,
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
    slStart: 1,
  },
  {
    roll: "23BSFT102",
    email: "23bsft102@gcu.edu.in",
    name: "Rahul Krishnan",
    dept: "BSFT",
    programmeTitle: "Bachelor of Science Food Science and Technology",
    programmeCode: "BSFT",
    gradeCardNo: "GCBSFT00002",
    slStart: 9,
  },
];

const rows = [headers];
for (const student of students) {
  const semesters = [
    ["IV", "April - 2026"],
    ["V", "December - 2026"],
  ];
  semesters.forEach(([semLabel, examMonth], semIndex) => {
    courses.forEach((course, courseIndex) => {
      rows.push(
        courseRow(
          student.slStart + semIndex * courses.length + courseIndex,
          student,
          course,
          semLabel,
          examMonth,
        ),
      );
    });
  });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Marks Template");

const outPath = path.join(__dirname, "..", "public", "marks_template_final.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Wrote", outPath);
