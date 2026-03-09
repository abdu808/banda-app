const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'بينات جمعية صبيا - بطافات 1300.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

if (data.length > 0) {
    console.log('Headers:', data[0]);
    console.log('First row of data:', data[1]);
} else {
    console.log('Excel file is empty');
}
