export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

export const USER_ROLES = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Faculty', label: 'Faculty' },
  { value: 'Registrar', label: 'Registrar' },
  { value: 'Moderator', label: 'Moderator' }
];

export const COURSE_TYPES = [
  { value: 'Theory', label: 'Theory' },
  { value: 'Practical', label: 'Practical' },
  { value: 'Integrated', label: 'Integrated' }
];

export const ELECTIVE_TYPES = [
  { value: 'Core', label: 'Core' },
  { value: 'Professional Elective', label: 'Professional Elective' },
  { value: 'Open Elective', label: 'Open Elective' },
  { value: 'Audit Course', label: 'Audit Course' }
];

export const YEARS = [
  { value: 1, label: 'First Year' },
  { value: 2, label: 'Second Year' },
  { value: 3, label: 'Third Year' },
  { value: 4, label: 'Fourth Year' }
];

export const SEMESTERS = [
  { value: 1, label: 'Semester 1' },
  { value: 2, label: 'Semester 2' },
  { value: 3, label: 'Semester 3' },
  { value: 4, label: 'Semester 4' },
  { value: 5, label: 'Semester 5' },
  { value: 6, label: 'Semester 6' },
  { value: 7, label: 'Semester 7' },
  { value: 8, label: 'Semester 8' }
];

export const HONORIFICS = [
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Prof.', label: 'Prof.' },
  { value: 'Mr.', label: 'Mr.' },
  { value: 'Ms.', label: 'Ms.' },
  { value: 'Mrs.', label: 'Mrs.' }
];

export const EXAM_TITLES = [
  { value: 'End Semester Examination', label: 'End Semester Examination' },
  { value: 'Mid-Term - I', label: 'Mid-Term - I' },
  { value: 'Mid-Term - II', label: 'Mid-Term - II' },
  { value: 'Continuous Assessment', label: 'Continuous Assessment' },
  { value: 'OBE', label: 'OBE' }
];

/**
 * Calculates academic year based on system date:
 * If month > May (Month 5), academic year is current year to next year (e.g. 2026-27).
 * Otherwise (up to May), academic year is previous year to current year (e.g. 2025-26).
 */
export const getAcademicYear = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // 1 to 12

  if (currentMonth > 5) {
    const nextYearShort = String((currentYear + 1) % 100).padStart(2, '0');
    return `${currentYear}-${nextYearShort}`;
  } else {
    const prevYear = currentYear - 1;
    const currentYearShort = String(currentYear % 100).padStart(2, '0');
    return `${prevYear}-${currentYearShort}`;
  }
};

export const BLOOM_LEVELS = [
  { value: 'Remember', label: 'Remember (Level 1)' },
  { value: 'Understand', label: 'Understand (Level 2)' },
  { value: 'Apply', label: 'Apply (Level 3)' },
  { value: 'Analyze', label: 'Analyze (Level 4)' },
  { value: 'Evaluate', label: 'Evaluate (Level 5)' },
  { value: 'Create', label: 'Create (Level 6)' }
];
