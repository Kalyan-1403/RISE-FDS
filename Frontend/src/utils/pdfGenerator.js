import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const getRatingLabel = (avg) => {
  if (avg >= 9) return 'Outstanding';
  if (avg >= 8) return 'Excellent';
  if (avg >= 7) return 'Very Good';
  if (avg >= 6) return 'Good';
  if (avg >= 5) return 'Average';
  if (avg >= 4) return 'Fair';
  if (avg >= 3) return 'Below Average';
  return 'Needs Improvement';
};

export const generateFacultyPDF = (faculty, statistics, collegeName) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(255, 107, 157);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RISE Krishna Sai Prakasam Group of Institutions', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Faculty Feedback Analysis Report', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth / 2, 28, { align: 'center' });

  // Faculty Info
  doc.setTextColor(45, 52, 54);
  let y = 45;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${faculty.name}`, 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const infoData = [
    ['Faculty Code', faculty.code],
    ['Subject', faculty.subject],
    ['College', collegeName || faculty.college],
    ['Department', faculty.dept],
    ['Year', faculty.year],
    ['Semester', faculty.sem],
    ['Section', faculty.sec],
  ];

  autoTable(doc, {
    startY: y,
    body: infoData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, fillColor: [255, 238, 170] },
      1: { cellWidth: 60 },
    },
    tableWidth: 110,
    margin: { left: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Process each slot
  const slots = [];
  if (statistics?.hasSlot1 && statistics.slot1) slots.push({ label: 'Slot 1 - Previous Feedback Cycle', data: statistics.slot1 });
  if (statistics?.hasSlot2 && statistics.slot2) slots.push({ label: 'Slot 2 - Latest Feedback Cycle', data: statistics.slot2 });

  slots.forEach((slot) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(139, 92, 246);
    doc.text(slot.label, 14, y);
    y += 3;

    doc.setTextColor(45, 52, 54);

    // Summary stats
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Responses: ${slot.data.responseCount}`, 14, y + 6);
    doc.text(`Overall Average: ${slot.data.overallAverage} / 10`, 90, y + 6);
    doc.text(`Performance: ${getRatingLabel(parseFloat(slot.data.overallAverage))}`, 150, y + 6);
    y += 12;

    // Parameter Scores Table
    const paramRows = PARAMETERS.map((param, idx) => {
      const stats = slot.data.parameterStats[param];
      return [
        (idx + 1).toString(),
        param,
        stats ? stats.average : 'N/A',
        stats ? `${stats.percentage}%` : 'N/A',
        stats ? stats.totalRatings.toString() : '0',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['S.No', 'Parameter', 'Avg Rating', 'Percentage', 'Responses']],
      body: paramRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 10;

    // Rating Distribution
    if (slot.data.ratingDistribution) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Rating Distribution', 14, y);
      y += 3;

      const distRows = Object.entries(slot.data.ratingDistribution)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .map(([rating, count]) => {
          const total = Object.values(slot.data.ratingDistribution).reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
          return [rating, count.toString(), `${pct}%`];
        });

     autoTable(doc, {
        startY: y,
        head: [['Rating', 'Count', 'Percentage']],
        body: distRows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [255, 107, 157], textColor: [255, 255, 255] },
        tableWidth: 80,
        margin: { left: 14 },
      });

      y = doc.lastAutoTable.finalY + 12;
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `RISE Feedback Management System | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const fileName = `${faculty.name}_${faculty.college}_${faculty.dept}_Feedback_Report.pdf`;
  doc.save(fileName);
  return fileName;
};

export const generateDepartmentPDF = (deptKey, facultyList, allStats, collegeName) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(139, 92, 246);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Department Report: ${deptKey}`, pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`${collegeName} | Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

  let y = 40;

  // Faculty overview table
  const rows = facultyList.map((f, idx) => {
    const stats = allStats[f.id];
    const avg = stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 'N/A';
    const responses = stats?.totalResponses || 0;
    return [
      (idx + 1).toString(),
      f.code,
      f.name,
      f.subject,
      `Y${f.year} S${f.sem}`,
      avg.toString(),
      responses.toString(),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Code', 'Name', 'Subject', 'Year/Sem', 'Avg Rating', 'Responses']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [255, 107, 157], textColor: [255, 255, 255] },
    margin: { left: 10, right: 10 },
  });

  const fileName = `${deptKey}_Department_Report.pdf`;
  doc.save(fileName);
  return fileName;
};

export const generateAbstractPDF = (college, department, sectionInfo, facultyWithStats) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape
  const { year, sem, sec } = sectionInfo;
  const pageW = doc.internal.pageSize.getWidth();

  // Guard against empty data to prevent invisible crashes
  if (!facultyWithStats || facultyWithStats.length === 0) {
    doc.setFontSize(12);
    doc.text("No Faculty Data Available.", 14, 20);
    doc.save(`Abstract_${college}_${department}_Sec${sec}_Error.pdf`);
    return;
  }

  // --- PAGE 1: PERFORMANCE MATRIX ---
  doc.setFillColor(255, 107, 157);
  doc.rect(0, 0, pageW, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RISE KRISHNA SAI PRAKASAM GROUP OF INSTITUTIONS', pageW / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Student Feedback Abstract — Average Ratings Compiled', pageW / 2, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${department} | Year ${year} | Sem ${sem} | Sec ${sec}`, pageW / 2, 28, { align: 'center' });

  let y = 42;

  // Build Headers: S.No, Parameters, [Faculty 1], [Faculty 2], ...
  const tableHead = [
    ['S.No', 'Parameters', ...facultyWithStats.map(item => item.faculty?.subject || item.faculty?.name || 'Unknown')]
  ];

  // Build Rows: 1 to 15
  const tableBody = PARAMETERS.map((param, idx) => [
    (idx + 1).toString(),
    param,
    ...facultyWithStats.map(item => {
      return item.stats?.parameterStats?.[param] ? item.stats.parameterStats[param].average.toFixed(1) : '—';
    })
  ]);

  // Add Footer Rows for Overalls and Totals
  tableBody.push(['', 'OVERALL AVERAGE', ...facultyWithStats.map(item => {
    return item.stats?.overallAverage ? parseFloat(item.stats.overallAverage).toFixed(2) : '—';
  })]);

  tableBody.push(['', 'TOTAL RESPONSES', ...facultyWithStats.map(item => {
    return item.stats?.responseCount ? item.stats.responseCount.toString() : '0';
  })]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle' },
    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 78 } // Locks width so all 15 strings fit without wrapping too much
    },
    didParseCell: (data) => {
      // Highlight the Average and Response rows
      if (data.row.index >= PARAMETERS.length && data.section === 'body') {
        data.cell.styles.fillColor = [240, 249, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [15, 23, 42];
      }
    }
  });

  // --- PAGE 2: SENTIMENT ANALYSIS ---
  doc.addPage('a4', 'l');
  doc.setTextColor(45, 52, 54);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Student Insights & Sentiment Analysis', 14, 15);

  const summaryBody = facultyWithStats.map(item => {
    const s = item.sentiment;
    if (s.total === 0) {
      return [`${item.faculty?.name}\n(${item.faculty?.subject || 'N/A'})`, 'No feedback responses submitted yet.'];
    }
    return [
      `${item.faculty?.name}\n(${item.faculty?.subject || 'N/A'})`,
      `• POSITIVE (${s.pos}/${s.total}): ${s.pos} students felt satisfied with the teaching style, specifically citing strengths in "${s.top}".\n\n` +
      `• IMPROVEMENTS NEEDED (${s.neg}/${s.total}): ${s.neg} students felt teaching needs improvement in areas such as "${s.low}".`
    ];
  });

  autoTable(doc, {
    startY: 22,
    head: [['Faculty Name & Subject', 'Summarized Feedback & Sentiment']],
    body: summaryBody,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 5, lineHeight: 1.4 },
    headStyles: { fillColor: [255, 107, 157], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 'auto' }
    }
  });

  doc.save(`Abstract_${college}_${department}_Sec${sec}.pdf`);
};
export const generateCollegePDF = (college, deptStructure, masterList, getFeedbackFn, calcStatsFn) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(255, 107, 157);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${college} College - Complete Report`, pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

  let y = 40;
  const depts = deptStructure[college] || {};

  Object.keys(depts).forEach((dept) => {
    const deptKey = `${college}_${dept}`;
    const faculty = masterList[deptKey] || [];

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(139, 92, 246);
    doc.text(`${dept} Department (${faculty.length} faculty)`, 14, y);
    y += 6;
    doc.setTextColor(45, 52, 54);

    if (faculty.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('No faculty data available', 14, y);
      y += 10;
      return;
    }

    const rows = faculty.map((f, idx) => {
      const feedback = getFeedbackFn(f.id, f.year, f.sem);
      const stats = calcStatsFn(feedback);
      const avg = stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 'N/A';
      return [(idx + 1).toString(), f.code, f.name, f.subject, avg.toString(), (feedback?.length || 0).toString()];
    });

    autoTable(doc, {
      startY: y,
      head: [['#', 'Code', 'Name', 'Subject', 'Avg', 'Responses']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 107, 157], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 12;
  });

  const fileName = `${college}_College_Complete_Report.pdf`;
  doc.save(fileName);
  return fileName;
};