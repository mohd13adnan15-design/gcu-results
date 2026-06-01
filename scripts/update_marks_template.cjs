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
  "Total Marks Theory", "Total Marks Practical", "Status", "Grade Obtained", "Grade Points", "Image Path",
];

const exampleRow = [
  1,
  "23bsft101@gcu.edu.in",
  "Abigail Albert Anbudurai",
  "BSFT",
  "Garden City University",
  "SCHOOL OF SCIENCES",
  "Bachelor of Science Food Science and Technology, Biochemistry and Microbiology",
  "BSFT",
  "23BSFT101",
  "April - 2026",
  "2026-05-04",
  "VI",
  "GCBSFT00021",
  "CORE COURSE",
  "THEORY",
  1,
  "23BSFT101T1",
  "Food Chemistry",
  4,
  4,
  40,
  0,
  16,
  0,
  35,
  0,
  60,
  0,
  24,
  0,
  52,
  0,
  100,
  0,
  "PASS",
  "A",
  8,
  "23BSFT101.jpg",
];

const targets = [
  path.join(__dirname, "../public/marks_template_final.xlsx"),
  path.join(__dirname, "../src/routes/marks_template_final.xlsx"),
];

for (const filePath of targets) {
  try {
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
    XLSX.writeFile(wb, filePath);
    console.log("Updated template:", filePath);
  } catch (error) {
    console.warn("Skipped template path:", filePath, error.message);
  }
}
