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

export const generateAbstractPDF = (college, department, sectionInfo, facultyWithStats, suggestions = []) => {
  const doc     = new jsPDF('l', 'mm', 'a4');
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const margin  = 10;
  const usableW = pageW - 2 * margin;
  const { year, sem, sec } = sectionInfo;

  const validFaculty = facultyWithStats.filter(item => item.stats);

  // Total responses = max responseCount across faculty (same batch)
  const totalResponses = validFaculty.reduce((max, item) => {
    const sd = item.stats?.hasSlot2 ? (item.stats?.slot2 || item.stats?.slot1) : item.stats?.slot1;
    return Math.max(max, sd?.responseCount || 0);
  }, 0);

  // ── Color palette (exact from form CSS) ────────────────────
  const PINK    = [255, 107, 157];   // #ff6b9d
  const YELLOW  = [254, 202,  87];   // #feca57
  const PURPLE  = [139,  92, 246];   // #8b5cf6
  const LPURPLE = [237, 233, 254];   // light purple tint
  const LYELLOW = [255, 251, 234];   // #fffbea
  const LBLUE   = [240, 249, 255];   // #f0f9ff
  const LGRAY   = [226, 232, 240];   // #e2e8f0
  const DARK    = [ 45,  52,  54];
  const WHITE   = [255, 255, 255];

  const ratingBg = (val) => {
    const n = parseFloat(val);
    if (isNaN(n))  return [248, 250, 252];
    if (n >= 9)    return [209, 250, 229];
    if (n >= 7)    return [219, 234, 254];
    if (n >= 5)    return [254, 243, 199];
    return               [254, 226, 226];
  };
  const ratingFg = (val) => {
    const n = parseFloat(val);
    if (isNaN(n))  return [100, 116, 139];
    if (n >= 9)    return [  6,  95,  70];
    if (n >= 7)    return [ 30,  64, 175];
    if (n >= 5)    return [120,  53,  15];
    return               [127,  29,  29];
  };

  // ══════════════════════════════════════════════════════════
  // HEADER — mirrors .modal-header gradient (#ff6b9d → #feca57)
  // ══════════════════════════════════════════════════════════
  const hdrH = 44;
  // Base pink fill
  doc.setFillColor(...PINK);
  doc.rect(0, 0, pageW, hdrH, 'F');
  // Yellow gradient overlay (right side)
  doc.setFillColor(...YELLOW);
  doc.rect(pageW * 0.68, 0, pageW * 0.32, hdrH, 'F');
  // Blend strip (salmon) to smooth transition
  doc.setFillColor(255, 154, 122);
  doc.rect(pageW * 0.52, 0, pageW * 0.22, hdrH, 'F');

  doc.setTextColor(...WHITE);

  // h1 — institution name (uppercase like CSS text-transform: uppercase)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RISE KRISHNA SAI PRAKASAM GROUP OF INSTITUTIONS', pageW / 2, 10, { align: 'center' });

  // h2 — address
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Valluru (V), Ongole (M), Prakasam (Dt)', pageW / 2, 16, { align: 'center' });

  // h3 — form title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Feedback on Teaching and Learning', pageW / 2, 23, { align: 'center' });

  // p.form-title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('(Student Feedback Abstract — Average Ratings Compiled)', pageW / 2, 28.5, { align: 'center' });

  // Meta-tags strip — matches .meta-tags chips
  const tags = [
    `${department} Department`,
    `Year ${year}`,
    `Semester ${sem}`,
    `Section ${sec}`,
    `${totalResponses} Responses`,
  ];
  const tagW = usableW / tags.length;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  tags.forEach((tag, i) => {
    const tx = margin + i * tagW;
    // White pill background (rgba simulation via light fill)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(tx + 1, 32.5, tagW - 2, 8, 2, 2, 'F');
    doc.setTextColor(80, 0, 50);
    doc.text(tag, tx + tagW / 2, 37.8, { align: 'center' });
  });

  let y = hdrH + 6;

  // ══════════════════════════════════════════════════════════
  // FACULTY MAPPING TABLE — mirrors .faculty-mapping-table
  // ══════════════════════════════════════════════════════════
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Subject - Faculty Mapping', pageW / 2, y, { align: 'center' });
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Faculty Name', 'Subject']],
    body: validFaculty.map(item => [item.faculty.name, item.faculty.subject || '\u2014']),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle', lineColor: LGRAY, lineWidth: 0.3 },
    headStyles: {
      fillColor: PURPLE,   // .mapping-table thead gradient start
      textColor: WHITE,
      fontStyle: 'bold',
      halign:    'left',
      fontSize:   9,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 80 },
    },
    tableWidth: 150,
    margin: { left: (pageW - 150) / 2 },
  });

  y = doc.lastAutoTable.finalY + 5;

  // ══════════════════════════════════════════════════════════
  // RATING SCALE BOX — mirrors .rating-info
  // ══════════════════════════════════════════════════════════
  doc.setFillColor(...LYELLOW);
  doc.setDrawColor(...YELLOW);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, usableW, 10, 2, 2, 'FD');
  doc.setTextColor(133, 77, 14);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Rating Scale:', margin + 4, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(
    '10=Outstanding  9=Excellent  8=Very Good  7=Good  6=Above Average  5=Average  4=Fair  3=Below Average  2=Poor  1=Very Poor',
    margin + 28, y + 6.5
  );
  y += 14;

  // ══════════════════════════════════════════════════════════
  // MAIN FEEDBACK TABLE — mirrors .feedback-table
  // ══════════════════════════════════════════════════════════
  const snoW   = 12;
  const paramW = 72;
  const facColW = Math.min(32, Math.max(15, (usableW - snoW - paramW - 2) / Math.max(validFaculty.length, 1)));

  const tableHead = [[
    'S.No',
    'Parameters',
    ...validFaculty.map(item => item.faculty.subject || item.faculty.name),
  ]];

  const tableBody = PARAMETERS.map((param, idx) => [
    idx + 1,
    param,
    ...validFaculty.map(item => {
      const sd = item.stats?.hasSlot2 ? item.stats?.slot2 : item.stats?.slot1;
      const ps = sd?.parameterStats?.[param];
      return ps ? ps.average.toFixed(1) : '\u2014';
    }),
  ]);

  // Overall Average row
  tableBody.push([
    '',
    'Overall Average',
    ...validFaculty.map(item => {
      const sd = item.stats?.hasSlot2 ? item.stats?.slot2 : item.stats?.slot1;
      return sd ? parseFloat(sd.overallAverage).toFixed(2) : '\u2014';
    }),
  ]);

  // Responses row
  tableBody.push([
    '',
    'No. of Responses',
    ...validFaculty.map(item => {
      const sd = item.stats?.hasSlot2 ? item.stats?.slot2 : item.stats?.slot1;
      return sd ? sd.responseCount : 0;
    }),
  ]);

  autoTable(doc, {
    startY: y,
    head:   tableHead,
    body:   tableBody,
    theme:  'grid',
    styles: {
      fontSize:    7.5,
      cellPadding: 2.2,
      valign:      'middle',
      lineColor:   LGRAY,
      lineWidth:   0.3,
    },
    headStyles: {
      // .feedback-table th: background: linear-gradient(135deg, #ffeaa7, #fed6e3)
      fillColor:  [255, 234, 167],   // #ffeaa7
      textColor:  DARK,
      fontStyle:  'bold',
      halign:     'center',
      fontSize:    8,
    },
    columnStyles: {
      0: { cellWidth: snoW,   halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: paramW, halign: 'left'  },
      ...Object.fromEntries(
        validFaculty.map((_, i) => [i + 2, { cellWidth: facColW, halign: 'center', fontStyle: 'bold' }])
      ),
    },
    margin: { left: margin, right: margin },
    didParseCell(data) {
      const isAvgRow  = data.row.index === PARAMETERS.length;
      const isRespRow = data.row.index === PARAMETERS.length + 1;
      const isFacCol  = data.column.index >= 2 && data.section === 'body';

      if (isAvgRow && data.section === 'body') {
        data.cell.styles.fillColor  = LPURPLE;
        data.cell.styles.textColor  = [109, 40, 217];
        data.cell.styles.fontStyle  = 'bold';
        data.cell.styles.fontSize   = 8.5;
      }
      if (isRespRow && data.section === 'body') {
        data.cell.styles.fillColor  = LBLUE;
        data.cell.styles.textColor  = [12, 74, 110];
        data.cell.styles.fontStyle  = 'bold';
      }
      if (isFacCol && !isAvgRow && !isRespRow) {
        data.cell.styles.fillColor = ratingBg(data.cell.raw);
        data.cell.styles.textColor = ratingFg(data.cell.raw);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ══════════════════════════════════════════════════════════
  // SUMMARIZED COMMENTS — mirrors per-faculty comments section
  // ══════════════════════════════════════════════════════════
  if (suggestions.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 15; }

    // Section header — mirrors the blue comments box
    doc.setFillColor(...LBLUE);
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, usableW, 10, 2, 2, 'FD');
    doc.setTextColor(12, 74, 110);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Comments on Each Faculty  (Summarized)', pageW / 2, y + 6.8, { align: 'center' });
    y += 14;

    suggestions.forEach((s, i) => {
      if (y > pageH - 28) { doc.addPage(); y = 15; }

      // Faculty label bar
      doc.setFillColor(219, 234, 254);
      doc.setDrawColor(147, 197, 253);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, usableW, 8, 1.5, 1.5, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${s.name}`, margin + 4, y + 5.5);
      if (s.subject) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(s.subject, margin + usableW - 3, y + 5.5, { align: 'right' });
      }
      y += 11;

      // Suggestion text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(s.suggestion, usableW - 8);
      doc.text(lines, margin + 4, y);
      y += lines.length * 4.5 + 5;
    });
  }

  // ══════════════════════════════════════════════════════════
  // FOOTER on every page
  // ══════════════════════════════════════════════════════════
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `RISE Feedback Management System - Abstract Report  |  ${department} | Year ${year} | Sem ${sem} | Sec ${sec} | ${totalResponses} Responses  |  Page ${i} of ${pageCount}`,
      pageW / 2, pageH - 5, { align: 'center' }
    );
  }

  const fileName = `Abstract_${college}_${department}_Y${year}_S${sem}_Sec${sec}.pdf`;
  doc.save(fileName);
  return fileName;
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