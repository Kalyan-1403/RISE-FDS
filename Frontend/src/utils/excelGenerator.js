import * as XLSX from 'xlsx';
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

export const generateFacultyExcel = (faculty, feedbackData, statistics) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Faculty Info
  const infoData = [
    ['RISE Krishna Sai Prakasam Group of Institutions'],
    ['Faculty Feedback Report'],
    [''],
    ['Faculty Name', faculty.name],
    ['Faculty Code', faculty.code],
    ['Subject', faculty.subject],
    ['College', faculty.college],
    ['Department', faculty.dept],
    ['Year', faculty.year],
    ['Semester', faculty.sem],
    ['Section', faculty.sec],
    ['Total Responses', statistics?.totalResponses || 0],
    ['Report Date', new Date().toLocaleDateString()],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(infoData);
  ws1['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Faculty Info');

  // Sheet 2: Parameter Averages (the feedback table format)
  const processSlot = (slotData, slotLabel) => {
    if (!slotData) return null;

    const headerRow = ['S.No', 'Parameter', 'Average Rating (out of 10)', 'Percentage (%)', 'Total Responses'];
    const rows = [
      [`${slotLabel} - Parameter Analysis`],
      [''],
      headerRow,
    ];

    PARAMETERS.forEach((param, idx) => {
      const stats = slotData.parameterStats[param];
      rows.push([
        idx + 1,
        param,
        stats ? parseFloat(stats.average) : 'N/A',
        stats ? parseFloat(stats.percentage) : 'N/A',
        stats ? stats.totalRatings : 0,
      ]);
    });

    rows.push(['']);
    rows.push(['Overall Average', '', slotData.overallAverage, `${((parseFloat(slotData.overallAverage) / 10) * 100).toFixed(1)}%`, slotData.responseCount]);

    return rows;
  };

  if (statistics?.hasSlot1 && statistics.slot1) {
    const slot1Rows = processSlot(statistics.slot1, 'Slot 1 - Previous Feedback Cycle');
    if (slot1Rows) {
      const ws2 = XLSX.utils.aoa_to_sheet(slot1Rows);
      ws2['!cols'] = [{ wch: 6 }, { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Slot 1 Analysis');
    }
  }

  if (statistics?.hasSlot2 && statistics.slot2) {
    const slot2Rows = processSlot(statistics.slot2, 'Slot 2 - Latest Feedback Cycle');
    if (slot2Rows) {
      const ws3 = XLSX.utils.aoa_to_sheet(slot2Rows);
      ws3['!cols'] = [{ wch: 6 }, { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Slot 2 Analysis');
    }
  }

  // Sheet 3: Raw Responses
  if (feedbackData && feedbackData.length > 0) {
    const rawHeader = ['Response #', 'Date', 'Slot', ...PARAMETERS, 'Comments'];
    const rawRows = [rawHeader];

    feedbackData.forEach((fb, idx) => {
      const paramValues = PARAMETERS.map((p) => fb.ratings[p] || '');
      rawRows.push([
        idx + 1,
        fb.timestamp ? new Date(fb.timestamp).toLocaleDateString() : 'N/A',
        fb.slot || 'N/A',
        ...paramValues,
        fb.comments || '',
      ]);
    });

    const ws4 = XLSX.utils.aoa_to_sheet(rawRows);
    ws4['!cols'] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 6 },
      ...PARAMETERS.map(() => ({ wch: 8 })),
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws4, 'Raw Responses');
  }

  // Comparison sheet if both slots exist
  if (statistics?.hasSlot1 && statistics?.hasSlot2) {
    const compRows = [
      ['Slot Comparison Analysis'],
      [''],
      ['S.No', 'Parameter', 'Slot 1 Avg', 'Slot 2 Avg', 'Change', 'Improved?'],
    ];

    PARAMETERS.forEach((param, idx) => {
      const s1 = statistics.slot1.parameterStats[param];
      const s2 = statistics.slot2.parameterStats[param];
      const s1Avg = s1 ? parseFloat(s1.average) : 0;
      const s2Avg = s2 ? parseFloat(s2.average) : 0;
      const change = (s2Avg - s1Avg).toFixed(2);
      compRows.push([
        idx + 1,
        param,
        s1Avg,
        s2Avg,
        parseFloat(change),
        parseFloat(change) >= 0 ? 'Yes' : 'No',
      ]);
    });

    compRows.push(['']);
    compRows.push([
      '',
      'OVERALL',
      parseFloat(statistics.slot1.overallAverage),
      parseFloat(statistics.slot2.overallAverage),
      (parseFloat(statistics.slot2.overallAverage) - parseFloat(statistics.slot1.overallAverage)).toFixed(2),
      parseFloat(statistics.slot2.overallAverage) >= parseFloat(statistics.slot1.overallAverage) ? 'Yes' : 'No',
    ]);

    const ws5 = XLSX.utils.aoa_to_sheet(compRows);
    ws5['!cols'] = [{ wch: 6 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Slot Comparison');
  }

  const fileName = `${faculty.name}_${faculty.college}_${faculty.dept}_Feedback.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
  return fileName;
};