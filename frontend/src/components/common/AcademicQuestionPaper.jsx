import React from 'react';
import GMRITLogo from './GMRITLogo';

// Revised Bloom's Taxonomy Levels
export const RBT_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

/**
 * Resolves the program acronym (e.g., 'CSE', 'ECE', 'EEE', 'IT') instead of a numeric branch_id or branch_code.
 */
export const resolveProgramAcronym = (progVal, courseCode = '', deptName = '') => {
  // If progVal is already an alpha acronym like 'CSE', 'EEE', 'IT', return it
  if (progVal && isNaN(progVal) && progVal.trim().length <= 6 && progVal.trim() !== '') {
    return progVal.trim().toUpperCase();
  }

  // 1. Check Course Code Prefix
  const cc = String(courseCode || '').toUpperCase();
  if (cc.includes('CS') || cc.includes('CSE')) return 'CSE';
  if (cc.includes('IT')) return 'IT';
  if (cc.includes('EC') || cc.includes('ECE')) return 'ECE';
  if (cc.includes('EE') || cc.includes('EEE')) return 'EEE';
  if (cc.includes('ME') || cc.includes('MECH')) return 'MECH';
  if (cc.includes('CE') || cc.includes('CIVIL')) return 'CIVIL';
  if (cc.includes('AI') || cc.includes('DS')) return 'AI&DS';
  if (cc.includes('CH') || cc.includes('CHEM')) return 'CHEM';

  // 2. Check Department / Branch Name
  const dn = String(deptName || '').toUpperCase();
  if (dn.includes('COMPUTER') || dn.includes('CSE')) return 'CSE';
  if (dn.includes('ELECTRONIC') && dn.includes('COMMUNICATION')) return 'ECE';
  if (dn.includes('ELECTRICAL')) return 'EEE';
  if (dn.includes('INFORMATION')) return 'IT';
  if (dn.includes('MECHANICAL')) return 'MECH';
  if (dn.includes('CIVIL')) return 'CIVIL';
  if (dn.includes('CHEMICAL')) return 'CHEM';

  return 'CSE';
};

/**
 * Normalizes CO display (e.g., 'CO1' -> '1', '1' -> '1')
 */
export const normalizeCO = (co) => {
  if (!co) return '1';
  const str = String(co).trim();
  const match = str.match(/\d+/);
  return match ? match[0] : str;
};

/**
 * Normalizes RBT Level display (e.g. 'remember' -> 'Remember')
 */
export const normalizeRBT = (rbt) => {
  if (!rbt) return 'Understand';
  const str = String(rbt).trim();
  const found = RBT_LEVELS.find(l => l.toLowerCase() === str.toLowerCase());
  return found || str;
};

/**
 * Converts numeric semester to ordinal (e.g., 5 -> "5th")
 */
export const formatSemesterOrdinal = (sem) => {
  if (!sem) return '5th';
  const n = parseInt(sem, 10);
  if (isNaN(n)) return String(sem);
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
};

/**
 * Converts numbers to words for Max Marks (e.g., 70 -> "70 (Seventy)")
 */
export const formatMarksWithWords = (marks) => {
  const m = parseInt(marks, 10) || 70;
  const wordsMap = {
    30: 'Thirty',
    40: 'Forty',
    50: 'Fifty',
    60: 'Sixty',
    70: 'Seventy',
    75: 'Seventy Five',
    80: 'Eighty',
    100: 'Hundred'
  };
  return wordsMap[m] ? `${m} (${wordsMap[m]})` : `${m}`;
};

/**
 * AcademicQuestionPaper
 * Renders the authentic GMRIT Autonomous examination paper:
 * - Real official GMRIT university crest logo
 * - (Autonomous Batch) & SEMESTER END REGULAR/SUPPLEMENTARY EXAMINATIONS header
 * - 4-Column Academic Metadata Grid with Program acronym (e.g. CSE, EEE, ECE, IT)
 * - SECTION-I: 7 x 2 = 14 Marks (Question 1, a to g) with RBT Level and COs
 * - SECTION-II: 4 x 14 = 56 Marks (Questions 2 to 9, 8M + 6M) with centered OR rows
 * - Pure academic table rendering (NO dropdowns, NO textarea borders or resize boxes)
 */
export const AcademicQuestionPaper = ({
  paper,
  editable = false,
  onQuestionChange = null
}) => {
  if (!paper) return null;

  const content = paper.generated_content || paper;
  const sections = content.sections || [];

  // Metadata resolution
  const degree = content.degree || 'B.Tech.';
  const rawProg = content.program || content.department_name || content.branch_code || 'CSE';
  const program = resolveProgramAcronym(rawProg, content.course_code || paper.course_code, content.department_name || paper.branch_name);
  const academicYear = content.academic_year || paper.academic_year || '2026-2027';
  const semesterStr = formatSemesterOrdinal(content.semester || paper.sem || 5);
  const courseCode = content.course_code || paper.course_code || '23CS305';
  const courseName = content.course_name || paper.course_name || 'Object Oriented Programming through Java';
  const duration = content.duration || paper.duration || '3 Hours';
  const maxMarksFormatted = formatMarksWithWords(content.total_marks || paper.total_marks || 70);
  const regulation = content.regulation || 'AR23';
  const examTitle = content.exam_title || content.title || paper.title || `SEMESTER END REGULAR/SUPPLEMENTARY EXAMINATIONS (${regulation}), NOV. – 2026`;
  const isAutonomous = content.autonomous_batch !== false;

  const sec1 = sections[0] || null;
  const sec2 = sections[1] || null;
  const remainingSecs = sections.slice(2);

  return (
    <div className="academic-qp-sheet" style={{
      backgroundColor: '#ffffff',
      color: '#000000',
      fontFamily: "'Times New Roman', Times, 'Plus Jakarta Sans', serif",
      fontSize: '10.5pt',
      lineHeight: 1.35,
      padding: '36px 42px',
      borderRadius: '4px',
      maxWidth: '920px',
      margin: '0 auto'
    }}>
      {/* ===================== INSTITUTION HEADER ===================== */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '6px' }}>
          <GMRITLogo height={65} />
        </div>
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          borderBottom: '2px solid #000000',
          paddingBottom: '8px',
          marginBottom: '10px'
        }}>
          {examTitle}
        </div>
      </div>

      {/* ===================== METADATA TABLE ===================== */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1.5px solid #000000',
        marginBottom: '16px',
        fontSize: '10pt'
      }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th style={{ width: '15%', padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Degree</th>
            <td style={{ width: '35%', padding: '5px 8px', borderRight: '1.5px solid #000000' }}>{degree}</td>
            <th style={{ width: '15%', padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Program</th>
            <td style={{ width: '35%', padding: '5px 8px', fontWeight: 'bold' }}>{program}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Academic Year</th>
            <td style={{ padding: '5px 8px', borderRight: '1.5px solid #000000' }}>{academicYear}</td>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Semester</th>
            <td style={{ padding: '5px 8px' }}>{semesterStr}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Course Code</th>
            <td style={{ padding: '5px 8px', borderRight: '1.5px solid #000000' }}>{courseCode}</td>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Course Title</th>
            <td style={{ padding: '5px 8px', fontWeight: '500' }}>{courseName}</td>
          </tr>
          <tr>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Duration</th>
            <td style={{ padding: '5px 8px', borderRight: '1.5px solid #000000' }}>{duration}</td>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Max. Marks</th>
            <td style={{ padding: '5px 8px', fontWeight: 'bold' }}>{maxMarksFormatted}</td>
          </tr>
        </tbody>
      </table>

      {/* Special Instructions (if any) */}
      {content.special_instructions && (
        <div style={{
          fontSize: '9.5pt',
          fontStyle: 'italic',
          marginBottom: '14px',
          padding: '4px 0',
          color: '#333333'
        }}>
          <strong>Note: </strong>{content.special_instructions}
        </div>
      )}

      {/* ===================== SECTION-I ===================== */}
      {sec1 && (
        <div style={{ marginBottom: '22px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontWeight: 'bold',
            fontSize: '11pt',
            marginBottom: '4px'
          }}>
            <span>SECTION-I</span>
            <span>
              {sec1.questions?.length || 7} x {sec1.marks_per_q || 2} = {sec1.section_marks || 14} Marks
            </span>
          </div>

          <div style={{ fontWeight: 'bold', fontSize: '10.5pt', marginBottom: '4px' }}>
            1.
          </div>

          {/* Section I Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1.5px solid #000000',
            fontSize: '10pt'
          }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', backgroundColor: '#f8fafc' }}>
                <th style={{ width: '45px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                  Questions (a to {String.fromCharCode(96 + Math.max(1, sec1.questions?.length || 7))})
                </th>
                <th style={{ width: '120px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>RBT Level</th>
                <th style={{ width: '60px', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>COs</th>
              </tr>
            </thead>
            <tbody>
              {sec1.questions?.map((q, qIdx) => {
                const subLetter = String.fromCharCode(97 + qIdx);
                const rbt = normalizeRBT(q.bloom_level || q.rbt_level || 'Remember');
                const co = normalizeCO(q.co || q.co_id || '1');
                const rawText = (q.question || '').replace(/^\s*(?:\([a-z]\)|[a-z]\))\s*/i, '').replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();

                return (
                  <tr key={qIdx} style={{ borderBottom: '1px solid #000000' }}>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                      {subLetter}
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                      <div
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => onQuestionChange && onQuestionChange(0, qIdx, e.currentTarget.innerText)}
                        style={{
                          outline: 'none',
                          whiteSpace: 'pre-wrap',
                          cursor: editable ? 'text' : 'default'
                        }}
                      >
                        {rawText}
                      </div>
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                      <span>{rbt}</span>
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                      <span>{co}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================== SECTION-II ===================== */}
      {sec2 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontWeight: 'bold',
            fontSize: '11pt',
            marginBottom: '6px'
          }}>
            <span>SECTION-II</span>
            <span>
              {sec2.questions?.length || 4} x {sec2.marks_per_q || 14} = {sec2.section_marks || 56} Marks
            </span>
          </div>

          {/* Section II Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1.5px solid #000000',
            fontSize: '10pt'
          }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', backgroundColor: '#f8fafc' }}>
                <th style={{ width: '45px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                  Questions (2 to {1 + (sec2.questions?.length || 4) * 2})
                </th>
                <th style={{ width: '120px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>RBT Level</th>
                <th style={{ width: '60px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>COs</th>
                <th style={{ width: '70px', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {sec2.questions?.map((q, pairIdx) => {
                const baseNum = 2 + pairIdx * 2;
                const q1Num = q.q1_no || baseNum;
                const q2Num = q.q2_no || (baseNum + 1);

                // Split question text into Choice Part 1 and Choice Part 2
                const orParts = q.question ? q.question.split(/\s*(?:\[OR\]|\(OR\))\s*/i) : [];
                const part1Text = orParts[0]?.trim() || '';
                const part2Text = orParts.slice(1).join('\n\n[OR]\n\n').trim() || '';

                // Extract subparts (a) and (b) for Part 1
                const p1Lines = part1Text.split('\n').filter(l => l.trim());
                let p1_a_text = '';
                let p1_b_text = '';
                let currentP1 = null;

                for (const line of p1Lines) {
                  if (/^\s*(?:\(?a\)?|\ba\))\s*[\.\)]/i.test(line)) {
                    currentP1 = 'a';
                    p1_a_text = line.replace(/^\s*(?:\(?a\)?|\ba\))\s*[\.\)]?\s*/i, '');
                  } else if (/^\s*(?:\(?b\)?|\bb\))\s*[\.\)]/i.test(line)) {
                    currentP1 = 'b';
                    p1_b_text = line.replace(/^\s*(?:\(?b\)?|\bb\))\s*[\.\)]?\s*/i, '');
                  } else if (currentP1 === 'a') {
                    p1_a_text += ' ' + line.trim();
                  } else if (currentP1 === 'b') {
                    p1_b_text += ' ' + line.trim();
                  } else if (!p1_a_text) {
                    p1_a_text = line.trim();
                  }
                }

                // Extract subparts (a) and (b) for Part 2
                const p2Lines = part2Text.split('\n').filter(l => l.trim());
                let p2_a_text = '';
                let p2_b_text = '';
                let currentP2 = null;

                for (const line of p2Lines) {
                  if (/^\s*(?:\(?a\)?|\ba\))\s*[\.\)]/i.test(line)) {
                    currentP2 = 'a';
                    p2_a_text = line.replace(/^\s*(?:\(?a\)?|\ba\))\s*[\.\)]?\s*/i, '');
                  } else if (/^\s*(?:\(?b\)?|\bb\))\s*[\.\)]/i.test(line)) {
                    currentP2 = 'b';
                    p2_b_text = line.replace(/^\s*(?:\(?b\)?|\bb\))\s*[\.\)]?\s*/i, '');
                  } else if (currentP2 === 'a') {
                    p2_a_text += ' ' + line.trim();
                  } else if (currentP2 === 'b') {
                    p2_b_text += ' ' + line.trim();
                  } else if (!p2_a_text) {
                    p2_a_text = line.trim();
                  }
                }

                // Marks for sub-questions
                const m_a = q.p1_marks || 8;
                const m_b = q.p2_marks || 6;

                // Clean inline tags
                const cleanP1A = p1_a_text.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();
                const cleanP1B = p1_b_text.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();
                const cleanP2A = p2_a_text.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();
                const cleanP2B = p2_b_text.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();

                // COs & Bloom for Q1
                const q1_co_a = normalizeCO(q.q1_co_a || q.q1_co || q.co || '1');
                const q1_co_b = normalizeCO(q.q1_co_b || q.q1_co || q.co || '2');
                const q1_rbt_a = normalizeRBT(q.q1_bloom_a || q.q1_bloom || q.bloom_level || 'Understand');
                const q1_rbt_b = normalizeRBT(q.q1_bloom_b || q.q1_bloom || q.bloom_level || 'Understand');

                // COs & Bloom for Q2
                const q2_co_a = normalizeCO(q.q2_co_a || q.q2_co || q1_co_a);
                const q2_co_b = normalizeCO(q.q2_co_b || q.q2_co || q1_co_b);
                const q2_rbt_a = normalizeRBT(q.q2_bloom_a || q.q2_bloom || q1_rbt_a);
                const q2_rbt_b = normalizeRBT(q.q2_bloom_b || q.q2_bloom || q1_rbt_b);

                return (
                  <React.Fragment key={pairIdx}>
                    {/* ===== QUESTION 1 (e.g. Q2) Part (a) ===== */}
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        {q1Num}
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 'bold', marginRight: '6px' }}>(a)</span>
                        <span
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newText = e.currentTarget.innerText;
                            const newP1 = `(a) ${newText}\n(b) ${cleanP1B}`;
                            const updated = `${newP1}\n\n[OR]\n\n${part2Text}`;
                            onQuestionChange && onQuestionChange(1, pairIdx, updated);
                          }}
                          style={{ outline: 'none', cursor: editable ? 'text' : 'default' }}
                        >
                          {cleanP1A}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        <span>{q1_rbt_a}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                        <span>{q1_co_a}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                        {m_a}M
                      </td>
                    </tr>

                    {/* ===== QUESTION 1 (e.g. Q2) Part (b) ===== */}
                    <tr style={{ borderBottom: '1.5px solid #000000' }}>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 'bold', marginRight: '6px' }}>(b)</span>
                        <span
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newText = e.currentTarget.innerText;
                            const newP1 = `(a) ${cleanP1A}\n(b) ${newText}`;
                            const updated = `${newP1}\n\n[OR]\n\n${part2Text}`;
                            onQuestionChange && onQuestionChange(1, pairIdx, updated);
                          }}
                          style={{ outline: 'none', cursor: editable ? 'text' : 'default' }}
                        >
                          {cleanP1B}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        <span>{q1_rbt_b}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                        <span>{q1_co_b}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                        {m_b}M
                      </td>
                    </tr>

                    {/* ===== CENTERED OR ROW ===== */}
                    <tr style={{
                      backgroundColor: '#ffffff',
                      borderBottom: '1.5px solid #000000',
                      borderTop: '1.5px solid #000000'
                    }}>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: 'center',
                          padding: '3px 0',
                          fontWeight: 'bold',
                          fontSize: '10pt',
                          letterSpacing: '1px'
                        }}
                      >
                        OR
                      </td>
                    </tr>

                    {/* ===== QUESTION 2 (e.g. Q3) Part (a) ===== */}
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        {q2Num}
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 'bold', marginRight: '6px' }}>(a)</span>
                        <span
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newText = e.currentTarget.innerText;
                            const newP2 = `(a) ${newText}\n(b) ${cleanP2B}`;
                            const updated = `${part1Text}\n\n[OR]\n\n${newP2}`;
                            onQuestionChange && onQuestionChange(1, pairIdx, updated);
                          }}
                          style={{ outline: 'none', cursor: editable ? 'text' : 'default' }}
                        >
                          {cleanP2A}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        <span>{q2_rbt_a}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                        <span>{q2_co_a}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                        {m_a}M
                      </td>
                    </tr>

                    {/* ===== QUESTION 2 (e.g. Q3) Part (b) ===== */}
                    <tr style={{ borderBottom: pairIdx === sec2.questions.length - 1 ? 'none' : '2px solid #000000' }}>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'top', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 'bold', marginRight: '6px' }}>(b)</span>
                        <span
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newText = e.currentTarget.innerText;
                            const newP2 = `(a) ${cleanP2A}\n(b) ${newText}`;
                            const updated = `${part1Text}\n\n[OR]\n\n${newP2}`;
                            onQuestionChange && onQuestionChange(1, pairIdx, updated);
                          }}
                          style={{ outline: 'none', cursor: editable ? 'text' : 'default' }}
                        >
                          {cleanP2B}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000' }}>
                        <span>{q2_rbt_b}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #000000', fontWeight: 'bold' }}>
                        <span>{q2_co_b}</span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                        {m_b}M
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================== ANY ADDITIONAL SECTIONS ===================== */}
      {remainingSecs.map((sec, extraIdx) => (
        <div key={extraIdx} style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontWeight: 'bold',
            fontSize: '11pt',
            marginBottom: '6px'
          }}>
            <span>{sec.section_name}</span>
            <span>[{sec.section_marks} Marks]</span>
          </div>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1.5px solid #000000',
            fontSize: '10pt'
          }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', backgroundColor: '#f8fafc' }}>
                <th style={{ width: '45px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #000000', fontWeight: 'bold' }}>Questions</th>
                <th style={{ width: '120px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>RBT Level</th>
                <th style={{ width: '60px', padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 'bold' }}>COs</th>
                <th style={{ width: '70px', padding: '6px 4px', textAlign: 'center' }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {sec.questions?.map((q, qIdx) => (
                <tr key={qIdx} style={{ borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #000000' }}>
                    {q.q_no || (qIdx + 1)}
                  </td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #000000', lineHeight: 1.4 }}>
                    {q.question}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000' }}>
                    {q.bloom_level || 'Understand'}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #000000' }}>
                    {normalizeCO(q.co || '1')}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>
                    {q.marks}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ===================== PAPER END MARKER ===================== */}
      <div style={{
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: '4px',
        fontSize: '12pt',
        marginTop: '24px',
        marginBottom: '10px'
      }}>
        ***********
      </div>
    </div>
  );
};

export default AcademicQuestionPaper;
