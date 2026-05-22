const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../public/marks_template_final.xlsx");
console.log("Reading template from:", filePath);

const wb = XLSX.readFile(filePath);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(ws);

console.log("Sheet structure (first 2 rows):");
console.log(JSON.stringify(data.slice(0, 2), null, 2));
