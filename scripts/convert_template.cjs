const XLSX = require("xlsx");
const path = require("path");

function toRoman(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return num;
  const map = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
    9: "IX", 10: "X"
  };
  return map[n] || num;
}

const filePath = path.join(__dirname, "../public/marks_template_final.xlsx");
console.log("Reading template from:", filePath);

const wb = XLSX.readFile(filePath);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(ws);

// Modify Semester values to Roman numerals
for (const row of data) {
  if (row["Semester"] !== undefined) {
    row["Semester"] = toRoman(row["Semester"]);
  }
}

// Convert back to sheet and write
const newWs = XLSX.utils.json_to_sheet(data);
wb.Sheets[sheetName] = newWs;
XLSX.writeFile(wb, filePath);
console.log("Template successfully updated with Roman numerals!");
