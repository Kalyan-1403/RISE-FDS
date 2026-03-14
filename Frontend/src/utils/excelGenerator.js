// FIX (MEDIUM): Replaced unmaintained 'xlsx' (SheetJS community) with 'exceljs'.
// exceljs is actively maintained, has a clean security record, and produces
// identical .xlsx output. Function signature is unchanged.

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const PARAMETERS = [
  'Knowledge of the subject',
  'Coming well prepared for the class',
  'Giving clear explanations',
  'Command of language',
  'Clear and audible voice',
  'Holding the attention of students through the class',
  'Providing more matter than in the textbooks',
  'Capability to clear the doubts of students',
  'Encouraging students to ask questions and participate',
  'Appreciating students as and when deserving',
  'Willingness to help students even out of the class',
  'Return of valued test papers/records in time',
  'Punctuality and following timetable schedule',
  'Coverage of syllabus',
  'Impartial (teaching all students alike)',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};

const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 };
const BODY_FONT   = { name: 'Arial', size: 10 };
const LABEL_FONT  = { bold: true, name: 'Arial', size: 10 };
const BORDER_THIN = { style: 'thin', color: { argb: 'FFCCCCCC' } };
const CELL_BORDER = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };

function applyHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 28;
}

function applyDataRow(row, isAlt = false) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = BODY_FONT;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', wrapText: true };
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8FC' } };
    }
  });
}

// ─── Sheet 1: Faculty Info ────────────────────────────────────────────────────

function buildInfoSheet(wb, faculty, statistics) {
  const ws = wb.addWorksheet('Faculty Info');
  ws.columns = [
    { key: 'label', width: 26 },
    { key: 'value', width: 42 },
  ];

  const titleRow = ws.addRow(['RISE Krishna Sai Prakasam Group of Institutions', '']);
  ws.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' }, name: 'Arial' };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  titleRow.height = 24;

  const subRow = ws.addRow(['Faculty Feedback Report', '']);
  ws.mergeCells(`A${subRow.number}:B${subRow.number}`);
  subRow.getCell(1).font = { italic: true, size: 11, color: { argb: 'FF555555' }, name: 'Arial' };
  subRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  const details = [
    ['Faculty Name',     faculty.name        || ''],
    ['Faculty Code',     faculty.code        || ''],
    ['Subject',          faculty.subject     || ''],
    ['College',          faculty.college     || ''],
    ['Department',       faculty.dept        || faculty.department || ''],
    ['Year',             faculty.year        || ''],
    ['Semester',         faculty.sem         || faculty.semester   || ''],
    ['Section',          faculty.sec         || faculty.section    || ''],
    ['Total Responses',  statistics?.totalResponses ?? 0],
    ['Report Date',      new Date().toLocaleDateString()],
  ];

  details.forEach(([label, value]) => {
    const r = ws.addRow([label, value]);
    r.getCell(1).font = LABEL_FONT;
    r.getCell(2).font = BODY_FONT;
    r.eachCell((cell) => { cell.border = CELL_BORDER; });
    r.height = 20;
  });
}

// ─── Sheet 2/3: Parameter Analysis (per slot) ────────────────────────────────

function buildSlotSheet(wb, slotData, slotLabel) {
  if (!slotData) return;

  const ws = wb.addWorksheet(slotLabel.includes('1') ? 'Slot 1 Analysis' : 'Slot 2 Analysis');
  ws.columns = [
    { key: 'sno',      width: 7  },
    { key: 'param',    width: 52 },
    { key: 'avg',      width: 22 },
    { key: 'pct',      width: 16 },
    { key: 'total',    width: 16 },
  ];

  const titleRow = ws.addRow([`${slotLabel} — Parameter Analysis`, '', '', '', '']);
  ws.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' }, name: 'Arial' };
  titleRow.height = 22;

  ws.addRow([]);

  const hdr = ws.addRow(['S.No', 'Parameter', 'Average (out of 10)', 'Percentage (%)', 'Total Ratings']);
  applyHeaderRow(hdr);

  PARAMETERS.forEach((param, idx) => {
    const stats = slotData.parameterStats?.[param];
    const r = ws.addRow([
      idx + 1,
      param,
      stats ? parseFloat(stats.average) : 'N/A',
      stats ? parseFloat(stats.percentage) : 'N/A',
      stats ? stats.totalRatings : 0,
    ]);
    applyDataRow(r, idx % 2 === 1);
    r.height = 18;
  });

  ws.addRow([]);

  const overall = ws.addRow([
    '', 'OVERALL AVERAGE',
    parseFloat(slotData.overallAverage),
    `${((parseFloat(slotData.overallAverage) / 10) * 100).toFixed(1)}%`,
    slotData.responseCount,
  ]);
  overall.eachCell((cell) => {
    cell.font = { bold: true, name: 'Arial', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8F5' } };
    cell.border = CELL_BORDER;
  });
}

// ─── Sheet 4: Raw Responses ───────────────────────────────────────────────────

function buildRawSheet(wb, feedbackData) {
  if (!feedbackData || feedbackData.length === 0) return;

  const ws = wb.addWorksheet('Raw Responses');
  ws.columns = [
    { key: 'no',   width: 10 },
    { key: 'date', width: 14 },
    { key: 'slot', width: 7  },
    ...PARAMETERS.map(() => ({ width: 9 })),
    { key: 'comments', width: 32 },
  ];

  const hdr = ws.addRow(['Response #', 'Date', 'Slot', ...PARAMETERS, 'Comments']);
  applyHeaderRow(hdr);

  feedbackData.forEach((fb, idx) => {
    const paramValues = PARAMETERS.map((p) => fb.ratings?.[p] ?? '');
    const r = ws.addRow([
      idx + 1,
      fb.timestamp ? new Date(fb.timestamp).toLocaleDateString() : 'N/A',
      fb.slot || 'N/A',
      ...paramValues,
      fb.comments || '',
    ]);
    applyDataRow(r, idx % 2 === 1);
    r.height = 18;
  });
}

// ─── Sheet 5: Slot Comparison ─────────────────────────────────────────────────

function buildComparisonSheet(wb, statistics) {
  if (!statistics?.hasSlot1 || !statistics?.hasSlot2) return;

  const ws = wb.addWorksheet('Slot Comparison');
  ws.columns = [
    { key: 'sno',      width: 7  },
    { key: 'param',    width: 52 },
    { key: 's1',       width: 14 },
    { key: 's2',       width: 14 },
    { key: 'change',   width: 12 },
    { key: 'improved', width: 12 },
  ];

  const titleRow = ws.addRow(['Slot Comparison Analysis', '', '', '', '', '']);
  ws.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' }, name: 'Arial' };
  titleRow.height = 22;

  ws.addRow([]);

  const hdr = ws.addRow(['S.No', 'Parameter', 'Slot 1 Avg', 'Slot 2 Avg', 'Change', 'Improved?']);
  applyHeaderRow(hdr);

  PARAMETERS.forEach((param, idx) => {
    const s1 = statistics.slot1.parameterStats?.[param];
    const s2 = statistics.slot2.parameterStats?.[param];
    const s1Avg = s1 ? parseFloat(s1.average) : 0;
    const s2Avg = s2 ? parseFloat(s2.average) : 0;
    const change = parseFloat((s2Avg - s1Avg).toFixed(2));
    const improved = change >= 0;

    const r = ws.addRow([idx + 1, param, s1Avg, s2Avg, change, improved ? 'Yes ▲' : 'No ▼']);
    applyDataRow(r, idx % 2 === 1);

    const changeCell = r.getCell(5);
    changeCell.font = {
      bold: true,
      color: { argb: improved ? 'FF27AE60' : 'FFC0392B' },
      name: 'Arial',
      size: 10,
    };
    r.height = 18;
  });

  ws.addRow([]);

  const s1Overall = parseFloat(statistics.slot1.overallAverage);
  const s2Overall = parseFloat(statistics.slot2.overallAverage);
  const overallChange = parseFloat((s2Overall - s1Overall).toFixed(2));

  const overallRow = ws.addRow([
    '', 'OVERALL', s1Overall, s2Overall, overallChange,
    overallChange >= 0 ? 'Yes ▲' : 'No ▼',
  ]);
  overallRow.eachCell((cell) => {
    cell.font = { bold: true, name: 'Arial', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8F5' } };
    cell.border = CELL_BORDER;
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export const generateFacultyExcel = async (faculty, feedbackData, statistics) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RISE FDS';
  wb.created = new Date();

  buildInfoSheet(wb, faculty, statistics);

  if (statistics?.hasSlot1 && statistics.slot1) {
    buildSlotSheet(wb, statistics.slot1, 'Slot 1 - Previous Feedback Cycle');
  }
  if (statistics?.hasSlot2 && statistics.slot2) {
    buildSlotSheet(wb, statistics.slot2, 'Slot 2 - Latest Feedback Cycle');
  }

  buildRawSheet(wb, feedbackData);
  buildComparisonSheet(wb, statistics);

  const dept = faculty.dept || faculty.department || '';
  const fileName = `${faculty.name}_${faculty.college}_${dept}_Feedback.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, fileName);
  return fileName;
};
