import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { courseService } from '../../services/courseService';
import { documentService } from '../../services/documentService';
import { bloomService } from '../../services/bloomService';
import { qlevelService } from '../../services/qlevelService';
import { qpService } from '../../services/qpService';
import SelectInput from '../../components/common/SelectInput';
import FormInput from '../../components/common/FormInput';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import AcademicQuestionPaper from '../../components/common/AcademicQuestionPaper';
import GMRITLogo from '../../components/common/GMRITLogo';
import ProtectQPModal from '../../components/common/ProtectQPModal';
import { YEARS, SEMESTERS, EXAM_TITLES, BLOOM_LEVELS, getAcademicYear } from '../../utils/constants';

export const EXAM_PRESETS = [
  {
    id: 'gmrit_ar23_end_70',
    name: 'GMRIT Autonomous End Exam (AR23) - 70 Marks',
    badge: 'Official University Pattern',
    recommended: true,
    description: 'Autonomous Batch: SECTION-I (7 x 2M = 14M, a to g) + SECTION-II (4 x 14M = 56M, 8M+6M internal choice Q2-Q9)',
    duration: '3 Hours',
    total_marks: 70,
    title: 'SEMESTER END REGULAR/SUPPLEMENTARY EXAMINATIONS (AR23), NOV. – 2026',
    special_instructions: '1. Answer ALL questions from SECTION-I and ANY FOUR questions from SECTION-II.\n2. All parts of the question must be answered in one place only.\n3. Assume suitable data if necessary.',
    sections: [
      {
        id: 1,
        name: 'SECTION-I',
        type: 'Short Answer',
        questions: 7,
        marks_per_q: 2,
        choice_mode: 'none',
        sub_division: 'none',
        question_cos: Array(7).fill('auto'),
        question_blooms: ['Remember', 'Remember', 'Remember', 'Remember', 'Remember', 'Remember', 'Remember']
      },
      {
        id: 2,
        name: 'SECTION-II',
        type: 'Long Answer',
        questions: 4,
        marks_per_q: 14,
        choice_mode: 'internal_choice',
        sub_division: 'two_subquestions',
        question_sub_divisions: ['two_subquestions', 'two_subquestions', 'two_subquestions', 'two_subquestions'],
        question_sub_marks: [
          { q1_a: 8, q1_b: 6, q2_a: 8, q2_b: 6 },
          { q1_a: 8, q1_b: 6, q2_a: 8, q2_b: 6 },
          { q1_a: 8, q1_b: 6, q2_a: 8, q2_b: 6 },
          { q1_a: 8, q1_b: 6, q2_a: 8, q2_b: 6 }
        ],
        question_cos: Array(4).fill('auto'),
        question_blooms: ['Understand', 'Apply', 'Understand', 'Understand']
      }
    ]
  },
  {
    id: 'gmrit_mid_30',
    name: 'GMRIT Mid-Term Examination - 30 Marks',
    badge: 'Mid Exam',
    recommended: false,
    description: 'SECTION-I: 5 x 2M = 10M + SECTION-II: 2 x 10M = 20M (Internal Choice Q2-Q5)',
    duration: '90 Minutes',
    total_marks: 30,
    title: 'MID-TERM EXAMINATIONS (AR23)',
    special_instructions: '1. Answer ALL questions from SECTION-I and ANY TWO questions from SECTION-II.',
    sections: [
      {
        id: 1,
        name: 'SECTION-I',
        type: 'Short Answer',
        questions: 5,
        marks_per_q: 2,
        choice_mode: 'none',
        sub_division: 'none',
        question_cos: Array(5).fill('auto'),
        question_blooms: Array(5).fill('Remember')
      },
      {
        id: 2,
        name: 'SECTION-II',
        type: 'Long Answer',
        questions: 2,
        marks_per_q: 10,
        choice_mode: 'internal_choice',
        sub_division: 'two_subquestions',
        question_sub_divisions: ['two_subquestions', 'two_subquestions'],
        question_sub_marks: [
          { q1_a: 5, q1_b: 5, q2_a: 5, q2_b: 5 },
          { q1_a: 5, q1_b: 5, q2_a: 5, q2_b: 5 }
        ],
        question_cos: Array(2).fill('auto'),
        question_blooms: Array(2).fill('Understand')
      }
    ]
  },
  {
    id: 'cia_50',
    name: 'Continuous Internal Assessment - 50 Marks',
    badge: 'Internal Assessment',
    recommended: false,
    description: 'SECTION-I: 5 x 2M = 10M + SECTION-II: 4 x 10M = 40M',
    duration: '2 Hours',
    total_marks: 50,
    title: 'CONTINUOUS INTERNAL ASSESSMENT (OBE)',
    special_instructions: '1. All questions are compulsory.',
    sections: [
      { id: 1, name: 'SECTION-I', type: 'Short Answer', questions: 5, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto'), question_blooms: Array(5).fill('auto') },
      { id: 2, name: 'SECTION-II', type: 'Long Answer', questions: 4, marks_per_q: 10, choice_mode: 'internal_choice', sub_division: 'two_subquestions', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'two_subquestions', 'two_subquestions'], question_cos: Array(4).fill('auto'), question_blooms: Array(4).fill('auto') }
    ]
  }
];

const QUESTION_TYPES = [
  { value: 'MCQ', label: "MCQ's" },
  { value: 'Short Answer', label: 'Short Answers' },
  { value: 'Long Answer', label: 'Long Answers' },
  { value: 'None', label: 'None' }
];

export const parseQuestionSubParts = (text, q, partPrefix = 'q1') => {
  if (!text) return null;

  const hasA = /(?:^|\n)\s*(?:\(?a\)?|\ba\))\s*[\.\)]?\s*/i.test(text);
  const hasB = /(?:^|\n)\s*(?:\(?b\)?|\bb\))\s*[\.\)]?\s*/i.test(text);
  if (!hasA || !hasB) return null;

  const lines = text.split('\n');
  const parts = [];
  let currentPart = null;

  for (const line of lines) {
    const subMatch = line.match(/^\s*([a-z])\s*[\.\)]\s*(.*)$/i);
    if (subMatch) {
      if (currentPart) parts.push(currentPart);
      currentPart = {
        letter: subMatch[1].toLowerCase(),
        fullText: line.trim()
      };
    } else if (currentPart) {
      if (line.trim()) {
        currentPart.fullText += '\n' + line;
      }
    } else if (line.trim()) {
      currentPart = {
        letter: '',
        fullText: line.trim()
      };
    }
  }
  if (currentPart) parts.push(currentPart);

  const labeled = parts.filter(p => p.letter);
  if (labeled.length < 2) return null;

  return labeled.map((p, idx) => {
    const raw = p.fullText;
    const marksMatch = raw.match(/\[(\d+)\s*M\]/i);
    const coMatch = raw.match(/\[(CO\d+)\]/i);

    let marks = marksMatch ? parseInt(marksMatch[1], 10) : null;
    if (!marks) {
      if (idx === 0) marks = q?.p1_marks || (q?.marks === 14 ? 8 : Math.ceil((q?.marks || 10) / 2));
      else marks = q?.p2_marks || (q?.marks ? Math.max(1, q.marks - (q?.p1_marks || 8)) : 6);
    }

    let co = coMatch ? coMatch[1] : null;
    if (!co) {
      if (idx === 0) {
        co = partPrefix === 'q2' ? (q?.q2_co_a || q?.q2_co || q?.co || 'CO1') : (q?.q1_co_a || q?.q1_co || q?.co || 'CO1');
      } else {
        co = partPrefix === 'q2' ? (q?.q2_co_b || q?.q2_co || q?.co || 'CO2') : (q?.q1_co_b || q?.q1_co || q?.co || 'CO2');
      }
    }

    let bloom = null;
    if (idx === 0) {
      bloom = partPrefix === 'q2' ? (q?.q2_bloom_a || q?.q2_bloom || q?.bloom_level) : (q?.q1_bloom_a || q?.q1_bloom || q?.bloom_level);
    } else {
      bloom = partPrefix === 'q2' ? (q?.q2_bloom_b || q?.q2_bloom || q?.bloom_level) : (q?.q1_bloom_b || q?.q1_bloom || q?.bloom_level);
    }

    // Strip inline marks and CO tags from display text
    const cleanText = raw.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();

    return {
      letter: p.letter,
      text: cleanText,
      marks,
      co,
      bloom
    };
  });
};

export const cleanQuestionText = (text) => {
  if (!text) return '';
  return text.replace(/\[\d+\s*M\]/gi, '').replace(/\[CO\d+\]/gi, '').trim();
};

const DEFAULT_COS = [
  { id: 'CO1', description: 'Analyze computational complexity and foundational architectures of the course domain', bloom_level: 'Understand', unit: 'Unit 1' },
  { id: 'CO2', description: 'Demonstrate algorithmic strategies, state management, and design paradigms', bloom_level: 'Apply', unit: 'Unit 2' },
  { id: 'CO3', description: 'Design modular solutions, interfaces, and component interaction models', bloom_level: 'Apply', unit: 'Unit 3' },
  { id: 'CO4', description: 'Formulate error handling, fault tolerance, and concurrency synchronization mechanisms', bloom_level: 'Analyze', unit: 'Unit 4' },
  { id: 'CO5', description: 'Evaluate architectural trade-offs, memory footprints, and system performance metrics', bloom_level: 'Evaluate', unit: 'Unit 4' },
  { id: 'CO6', description: 'Synthesize comprehensive engineering designs, methodologies, and system implementations', bloom_level: 'Create', unit: 'Unit 4' }
];

const DEFAULT_UNITS = [
  {
    id: 1,
    unit_key: 'Unit 1',
    unit_label: 'Unit-I',
    unit_title: 'Overview of Web Databases & Core Architecture',
    name: 'Unit-I: Overview of Web Databases & Core Architecture',
    hours: '11 Hours',
    weight: 25,
    topics: ['Web Database Architectures', 'Client & Server-Side Programming', 'Session Management & State Tracking', 'HTTP Gateways & CGI']
  },
  {
    id: 2,
    unit_key: 'Unit 2',
    unit_label: 'Unit-II',
    unit_title: 'Structured Databases & Relational Management',
    name: 'Unit-II: Structured Databases & Relational Management',
    hours: '13 Hours',
    weight: 25,
    topics: ['Relational Data Modeling', 'CRUD Operations & Constraints', 'Database Transactions & ACID Properties', 'Triggers & Python Connectivity']
  },
  {
    id: 3,
    unit_key: 'Unit 3',
    unit_label: 'Unit-III',
    unit_title: 'Unstructured Databases & Document Stores',
    name: 'Unit-III: Unstructured Databases & Document Stores',
    hours: '13 Hours',
    weight: 25,
    topics: ['NoSQL Architectures vs RDBMS', 'Document Data Modeling & Collections', 'CRUD Document Operations', 'Aggregation Pipelines & Cloud Clusters']
  },
  {
    id: 4,
    unit_key: 'Unit 4',
    unit_label: 'Unit-IV',
    unit_title: 'Database Connections, Security & Web Services',
    name: 'Unit-IV: Database Connections, Security & Web Services',
    hours: '11 Hours',
    weight: 25,
    topics: ['Native & Independent Database APIs', 'REST Web Services & JSON Payloads', 'Authentication & Authorization Controls', 'SQL/NoSQL Injection Mitigation']
  }
];

const formatExamDate = (dateVal) => {
  if (!dateVal) return '';
  const parts = String(dateVal).split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
  }
  return dateVal;
};

const QPGenerator = () => {
  const { user, branchName } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'details' | 'structure' | 'outcomes' | 'topics' | 'difficulty'
  const [activeTab, setActiveTab] = useState('details');

  const [courses, setCourses] = useState([]);
  const [blooms, setBlooms] = useState(['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']);
  const [qlevels, setQlevels] = useState([]);
  const [courseDocuments, setCourseDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [docScope, setDocScope] = useState('course'); // 'course' | 'all'
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDirectToDb, setUploadingDirectToDb] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPaper, setSavedPaper] = useState(null);
  const [showProtectModal, setShowProtectModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [extractingCOs, setExtractingCOs] = useState(false);
  const [extractingUnits, setExtractingUnits] = useState(false);
  const [coSourceInfo, setCoSourceInfo] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Details State - Initialized to GMRIT Autonomous Pattern
  const [institutionName, setInstitutionName] = useState('GMRIT DEEMED TO BE UNIVERSITY');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('gmrit_ar23_end_70');
  const [title, setTitle] = useState(EXAM_PRESETS[0].title);
  const [duration, setDuration] = useState('3 Hours');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Current system date + 1 day
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [academicYear, setAcademicYear] = useState(() => getAcademicYear());
  const [sem, setSem] = useState(5);
  const [totalMarks, setTotalMarks] = useState(70);
  const [specialInstructions, setSpecialInstructions] = useState(EXAM_PRESETS[0].special_instructions);

  // Material & Course Documents State
  const [materialText, setMaterialText] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 2. Structure State (Sections) - Defaults to GMRIT Autonomous AR23 (70M)
  const [sections, setSections] = useState(() => JSON.parse(JSON.stringify(EXAM_PRESETS[0].sections)));

  const handleApplyPreset = (presetId) => {
    const preset = EXAM_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setTotalMarks(preset.total_marks);
    setDuration(preset.duration);
    setTitle(preset.title);
    setSpecialInstructions(preset.special_instructions);
    setSections(JSON.parse(JSON.stringify(preset.sections)));
    showNotification(`Applied preset: ${preset.name}`);
  };

  const handleAcademicQuestionChange = (secIdx, qIdx, newText, metaUpdates = null) => {
    setGeneratedPaper(prev => {
      if (!prev || !prev.sections) return prev;
      const newSecs = [...prev.sections];
      const targetSec = { ...newSecs[secIdx] };
      const newQuestions = [...(targetSec.questions || [])];
      const targetQ = { ...newQuestions[qIdx] };

      if (newText !== null && newText !== undefined) {
        targetQ.question = newText;
      }
      if (metaUpdates) {
        Object.assign(targetQ, metaUpdates);
      }
      newQuestions[qIdx] = targetQ;
      targetSec.questions = newQuestions;
      newSecs[secIdx] = targetSec;

      return {
        ...prev,
        sections: newSecs
      };
    });
  };

  // 3. Course Outcomes (COs) State
  const [outcomes, setOutcomes] = useState(DEFAULT_COS);
  const [coDetectionStatus, setCoDetectionStatus] = useState('idle'); // 'idle' | 'found' | 'not_found'
  const [newCoId, setNewCoId] = useState('CO7');
  const [newCoDesc, setNewCoDesc] = useState('');
  const [newCoBloom, setNewCoBloom] = useState('Remember');
  const [newCoUnit, setNewCoUnit] = useState('Unit 1');

  // 4. Topics & Curriculum Units State
  const [topics, setTopics] = useState(DEFAULT_UNITS);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicWeight, setNewTopicWeight] = useState(25);
  const [unitConceptInputs, setUnitConceptInputs] = useState({});

  // Dynamic available units derived from extracted topics/units
  const availableUnits = useMemo(() => {
    if (!topics || topics.length === 0) {
      return [
        { unit_key: 'Unit 1', label: 'Unit 1: Foundations', unit_label: 'Unit-I' },
        { unit_key: 'Unit 2', label: 'Unit 2: Architecture', unit_label: 'Unit-II' },
        { unit_key: 'Unit 3', label: 'Unit 3: Implementation', unit_label: 'Unit-III' },
        { unit_key: 'Unit 4', label: 'Unit 4: Advanced Systems', unit_label: 'Unit-IV' }
      ];
    }
    return topics.map((t, idx) => {
      const uKey = t.unit_key || `Unit ${t.id || idx + 1}`;
      const uLabel = t.unit_label || uKey;
      const title = t.unit_title || t.name || '';
      return {
        unit_key: uKey,
        label: title ? `${uLabel}: ${title}` : uLabel,
        unit_label: uLabel,
        unit_title: title
      };
    });
  }, [topics]);

  // 5. Difficulty & Blooms State
  const [difficulty, setDifficulty] = useState({ easy: 40, medium: 40, hard: 20 });
  const [selectedBlooms, setSelectedBlooms] = useState(['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']);
  const [bloomDropdownSelect, setBloomDropdownSelect] = useState('');
  const [customBloomInput, setCustomBloomInput] = useState('');

  // Generated Paper Result
  const [generatedPaper, setGeneratedPaper] = useState(null);

  // Helper functions for question marks, sub-divisions, COs, and Blooms
  const getQuestionSubDivision = (sec, qIdx) => {
    if (!sec || sec.type !== 'Long Answer') return 'none';
    if (sec.question_sub_divisions && sec.question_sub_divisions[qIdx]) {
      return sec.question_sub_divisions[qIdx];
    }
    return sec.sub_division === 'none' ? 'none' : 'two_subquestions';
  };

  const getQuestionMarks = (sec, qIdx) => {
    const defaultTotal = parseInt(sec?.marks_per_q) || 14;
    // Default 14M divides into 8M (a) + 6M (b) pattern
    const defA = defaultTotal === 14 ? 8 : Math.ceil(defaultTotal / 2);
    const defB = defaultTotal - defA;

    const entry = sec?.question_sub_marks?.[qIdx];
    if (entry && typeof entry === 'object') {
      return {
        q1_a: entry.q1_a !== undefined ? entry.q1_a : defA,
        q1_b: entry.q1_b !== undefined ? entry.q1_b : defB,
        q2_a: entry.q2_a !== undefined ? entry.q2_a : (entry.q1_a !== undefined ? entry.q1_a : defA),
        q2_b: entry.q2_b !== undefined ? entry.q2_b : (entry.q1_b !== undefined ? entry.q1_b : defB),
        q1: entry.q1 !== undefined ? entry.q1 : defaultTotal,
        q2: entry.q2 !== undefined ? entry.q2 : (entry.q1 !== undefined ? entry.q1 : defaultTotal)
      };
    }
    return {
      q1_a: defA,
      q1_b: defB,
      q2_a: defA,
      q2_b: defB,
      q1: defaultTotal,
      q2: defaultTotal
    };
  };

  const getQuestionCOs = (sec, qIdx) => {
    const entry = sec?.question_cos?.[qIdx];
    if (entry && typeof entry === 'object') {
      return {
        q1: entry.q1 || 'auto',
        q2: entry.q2 || 'auto',
        q1_a: entry.q1_a || entry.q1 || 'auto',
        q1_b: entry.q1_b || entry.q1 || 'auto',
        q2_a: entry.q2_a || entry.q2 || 'auto',
        q2_b: entry.q2_b || entry.q2 || 'auto'
      };
    }
    if (typeof entry === 'string') {
      return {
        q1: entry,
        q2: entry,
        q1_a: entry,
        q1_b: entry,
        q2_a: entry,
        q2_b: entry
      };
    }
    return {
      q1: 'auto',
      q2: 'auto',
      q1_a: 'auto',
      q1_b: 'auto',
      q2_a: 'auto',
      q2_b: 'auto'
    };
  };

  const getQuestionBlooms = (sec, qIdx) => {
    const entry = sec?.question_blooms?.[qIdx];
    if (entry && typeof entry === 'object') {
      return {
        q1: entry.q1 || 'auto',
        q2: entry.q2 || 'auto',
        q1_a: entry.q1_a || entry.q1 || 'auto',
        q1_b: entry.q1_b || entry.q1 || 'auto',
        q2_a: entry.q2_a || entry.q2 || 'auto',
        q2_b: entry.q2_b || entry.q2 || 'auto'
      };
    }
    if (typeof entry === 'string') {
      return {
        q1: entry,
        q2: entry,
        q1_a: entry,
        q1_b: entry,
        q2_a: entry,
        q2_b: entry
      };
    }
    return {
      q1: 'auto',
      q2: 'auto',
      q1_a: 'auto',
      q1_b: 'auto',
      q2_a: 'auto',
      q2_b: 'auto'
    };
  };

  const calculateSectionSubtotal = (sec) => {
    if (!sec || sec.type === 'None') return 0;
    const numQ = parseInt(sec.questions || 0);
    let sum = 0;
    for (let i = 0; i < numQ; i++) {
      const subDiv = getQuestionSubDivision(sec, i);
      const m = getQuestionMarks(sec, i);
      if (subDiv === 'two_subquestions') {
        sum += (parseInt(m.q1_a) || 0) + (parseInt(m.q1_b) || 0);
      } else {
        sum += (parseInt(m.q1) || parseInt(sec.marks_per_q) || 0);
      }
    }
    return sum;
  };

  // Automatically calculate total marks from sections taking custom marks into account
  const totalCalculatedMarks = useMemo(() => {
    return sections
      .filter(sec => sec.type !== 'None')
      .reduce((sum, sec) => sum + calculateSectionSubtotal(sec), 0);
  }, [sections]);

  // Total topics weight
  const totalTopicWeight = useMemo(() => {
    return topics.reduce((sum, t) => sum + (parseInt(t.weight || 0)), 0);
  }, [topics]);

  // Live Word & Character counts for direct material editor
  const wordCount = useMemo(() => {
    if (!materialText || !materialText.trim()) return 0;
    return materialText.trim().split(/\s+/).filter(Boolean).length;
  }, [materialText]);

  const charCount = useMemo(() => {
    return materialText ? materialText.length : 0;
  }, [materialText]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [coursesRes, bloomsRes, qlevelsRes, allDocsRes] = await Promise.all([
        courseService.getAll(),
        bloomService.getAll(),
        qlevelService.getAll(),
        documentService.getAll()
      ]);

      if (coursesRes.success) {
        setCourses(coursesRes.data);
        if (coursesRes.data.length > 0 && !selectedCourse) {
          const activeCourses = coursesRes.data.filter(c => c.status === 1);
          if (activeCourses.length > 0) {
            setSelectedCourse(String(activeCourses[0].id));
            if (activeCourses[0].sem) setSem(activeCourses[0].sem);
          }
        }
      }

      if (allDocsRes.success) {
        setAllDocuments(allDocsRes.data);
      }

      const standardBlooms = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
      if (bloomsRes.success && bloomsRes.data.length > 0) {
        const dbTaxonomies = bloomsRes.data
          .filter(b => b.status === 1 && String(b.taxonomy || '').trim().toLowerCase() !== 'remembering')
          .map(b => String(b.taxonomy || '').trim().toLowerCase() === 'remember' ? 'Remember' : b.taxonomy);
        const mergedBlooms = Array.from(new Set([...standardBlooms, ...dbTaxonomies]));
        setBlooms(mergedBlooms);
        setSelectedBlooms(mergedBlooms);
      } else {
        setBlooms(standardBlooms);
        setSelectedBlooms(standardBlooms);
      }

      if (qlevelsRes.success && qlevelsRes.data.length > 0) {
        setQlevels(qlevelsRes.data.map(q => q.level));
      } else {
        setQlevels(['Easy', 'Medium', 'Hard']);
      }
    } catch (err) {
      setError(err.message || 'Failed to load configuration parameters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch faculty/admin uploaded documents from Database for the selected course
  const fetchCourseDocs = async (courseId) => {
    if (!courseId) {
      setCourseDocuments([]);
      setSelectedDocIds([]);
      return;
    }
    setLoadingDocs(true);
    try {
      const res = await documentService.getByCourse(courseId);
      if (res.success) {
        setCourseDocuments(res.data);
        // Pre-select all available documents for this course
        setSelectedDocIds(res.data.map(d => d.id));
      }
    } catch (e) {
      console.error('Failed to fetch course documents from database:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Upload document directly to DB for the active course
  const handleUploadDirectToDb = async (file) => {
    if (!file || !selectedCourse) return;
    setUploadingDirectToDb(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', selectedCourse);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      const res = await documentService.upload(formData);
      if (res.success) {
        showNotification(`✓ Uploaded and indexed "${file.name}" in database for this course!`);
        fetchCourseDocs(selectedCourse);
        // Refresh all documents
        const allRes = await documentService.getAll();
        if (allRes.success) setAllDocuments(allRes.data);
      }
    } catch (err) {
      showNotification(`Upload to database failed: ${err.message}`, 'error');
    } finally {
      setUploadingDirectToDb(false);
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseDocs(selectedCourse);
      const matched = courses.find(c => String(c.id) === String(selectedCourse));
      if (matched && matched.sem) {
        setSem(matched.sem);
      }
    } else {
      setCourseDocuments([]);
      setSelectedDocIds([]);
    }
  }, [selectedCourse, courses]);

  const showNotification = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4500);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4500);
    }
  };

  // Helper to dynamically get sequential section name for active sections (A, B, C...)
  const getDynamicSectionName = (sectionsList, targetIdx) => {
    const sec = sectionsList[targetIdx];
    if (!sec || sec.type === 'None') {
      return 'Section (Disabled / None)';
    }
    let activeCount = 0;
    for (let i = 0; i < targetIdx; i++) {
      if (sectionsList[i] && sectionsList[i].type !== 'None') {
        activeCount++;
      }
    }
    return `Section ${String.fromCharCode(65 + activeCount)}`;
  };

  // Helper to calculate exact question numbering range for each section (Q1 to Q5, Q6 to Q11, etc.)
  const getSectionQuestionRange = (sectionsList, targetIdx) => {
    let startQ = 1;
    for (let i = 0; i < targetIdx; i++) {
      const s = sectionsList[i];
      if (!s || s.type === 'None') continue;
      const count = parseInt(s.questions) || 0;
      if (s.type === 'Long Answer' && s.choice_mode === 'internal_choice') {
        startQ += count * 2;
      } else {
        startQ += count;
      }
    }
    const currentSec = sectionsList[targetIdx];
    const currentCount = parseInt(currentSec?.questions) || 1;
    const hasChoice = currentSec?.type === 'Long Answer' && currentSec?.choice_mode === 'internal_choice';
    const endQ = hasChoice ? startQ + currentCount * 2 - 1 : startQ + currentCount - 1;
    return { startQ, endQ };
  };

  // Exam Title change handler
  const handleExamTitleChange = (newTitle) => {
    setTitle(newTitle);
    const titleLower = (newTitle || '').toLowerCase();

    if (titleLower.includes('end semester') || titleLower.includes('end')) {
      setTotalMarks(70);
      setDuration('3 Hours');
      setSections([
        { id: 1, name: 'Section A', type: 'MCQ', questions: 10, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(10).fill('auto'), question_blooms: Array(10).fill('auto') },
        { id: 2, name: 'Section B', type: 'Short Answer', questions: 5, marks_per_q: 4, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto'), question_blooms: Array(5).fill('auto') },
        { id: 3, name: 'Section C', type: 'Long Answer', questions: 3, marks_per_q: 10, choice_mode: 'none', sub_division: 'mixed', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'], question_cos: Array(3).fill('auto'), question_blooms: Array(3).fill('auto') }
      ]);
      showNotification('Examination title set to End Semester Examination. Sections auto-configured.');
    } else if (titleLower.includes('mid')) {
      setTotalMarks(40);
      setDuration('2 Hours');
      setSections([
        { id: 1, name: 'Section A', type: 'Short Answer', questions: 5, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto'), question_blooms: Array(5).fill('auto') },
        { id: 2, name: 'Section B', type: 'Long Answer', questions: 3, marks_per_q: 10, choice_mode: 'none', sub_division: 'mixed', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'], question_cos: Array(3).fill('auto'), question_blooms: Array(3).fill('auto') }
      ]);
      showNotification(`Examination title set to ${newTitle}. Sections auto-configured.`);
    } else if (titleLower.includes('continuous') || titleLower.includes('obe')) {
      setTotalMarks(30);
      setDuration('1.5 Hours');
      setSections([
        { id: 1, name: 'Section A', type: 'Short Answer', questions: 5, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto'), question_blooms: Array(5).fill('auto') },
        { id: 2, name: 'Section B', type: 'Long Answer', questions: 2, marks_per_q: 10, choice_mode: 'none', sub_division: 'two_subquestions', question_sub_divisions: ['two_subquestions', 'two_subquestions'], question_cos: Array(2).fill('auto'), question_blooms: Array(2).fill('auto') }
      ]);
      showNotification(`Examination title set to ${newTitle}. Sections auto-configured.`);
    }
  };

  // Process dropped or selected file for material editor
  const processMaterialFile = async (file) => {
    if (!file) return;
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result || '';
        setMaterialText(prev => (prev ? prev + '\n\n' + text : text));
        showNotification(`Extracted notes from ${file.name} directly into editor!`);
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      setUploadingDoc(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedCourse) formData.append('course_id', selectedCourse);

        const res = await documentService.extractText(formData);
        if (res.success && res.extracted_text) {
          setMaterialText(prev => (prev ? prev + '\n\n' + res.extracted_text : res.extracted_text));
          showNotification(`Extracted ${res.character_count.toLocaleString()} characters from ${file.name}!`);
        } else {
          showNotification(`Extracted text from ${file.name}`);
        }
      } catch (err) {
        showNotification(`Could not extract text from ${file.name}: ${err.message}`, 'error');
      } finally {
        setUploadingDoc(false);
      }
    } else {
      showNotification('Please upload a PDF, TXT, or DOCX document', 'error');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processMaterialFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processMaterialFile(e.target.files[0]);
    }
  };

  const toggleDocSelection = (docId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const doc = [...courseDocuments, ...allDocuments].find(d => d.id === docId);
    setSelectedDocIds(prev => {
      const isAlreadySelected = prev.length === 1 && prev[0] === docId;
      if (isAlreadySelected) {
        return [];
      } else {
        if (doc && doc.course_id && String(doc.course_id) !== String(selectedCourse)) {
          setSelectedCourse(String(doc.course_id));
        }
        return [docId];
      }
    });
  };

  const handleClearDocSelections = () => {
    setSelectedDocIds([]);
    showNotification('Cleared document selection');
  };

  const handleDownloadDoc = async (doc, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!doc || !doc.id) return;
    try {
      showNotification(`Downloading ${doc.file_name || 'document'}...`);
      await documentService.downloadDocument(doc.id, doc.file_name);
      showNotification(`✓ Downloaded ${doc.file_name || 'document'} successfully!`);
    } catch (err) {
      console.error('Download error:', err);
      const downloadUrl = documentService.getDownloadUrl(doc.id);
      window.open(downloadUrl, '_blank');
    }
  };

  const handleOpenInspect = async (doc, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setLoadingPreview(true);
    setPreviewDoc(doc);
    try {
      const res = await documentService.getById(doc.id);
      if (res.success && res.data) {
        setPreviewDoc(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch full document text:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Section Management
  const handleAddSection = () => {
    const newSec = {
      id: Date.now(),
      name: `Section`,
      type: 'Long Answer',
      questions: 3,
      marks_per_q: 10,
      choice_mode: 'none',
      sub_division: 'mixed',
      question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'],
      question_cos: ['auto', 'auto', 'auto'],
      question_blooms: ['auto', 'auto', 'auto']
    };
    setSections([...sections, newSec]);
  };

  const handleUpdateSection = (index, field, value) => {
    const updated = [...sections];
    if (field === 'type' && value === 'Long Answer') {
      if (!updated[index].choice_mode) updated[index].choice_mode = 'none';
      if (!updated[index].sub_division) updated[index].sub_division = 'two_subquestions';
    }
    const parsedVal = (field === 'questions' || field === 'marks_per_q') ? Math.max(1, parseInt(value) || 1) : value;
    updated[index][field] = parsedVal;

    if (field === 'marks_per_q') {
      const newM = Math.max(2, parseInt(value) || 14);
      if (Array.isArray(updated[index].question_sub_marks)) {
        updated[index].question_sub_marks = updated[index].question_sub_marks.map(mObj => {
          const half = Math.ceil(newM / 2);
          const a = Math.min(mObj.q1_a || half, Math.max(1, newM - 1));
          const b = Math.max(1, newM - a);
          return {
            ...mObj,
            q1: newM,
            q2: newM,
            q1_a: a,
            q1_b: b,
            q2_a: a,
            q2_b: b
          };
        });
      }
    }

    if (field === 'questions') {
      const numQ = Math.max(1, parseInt(value) || 1);
      if (updated[index].type === 'Long Answer') {
        const currentList = Array.isArray(updated[index].question_sub_divisions) ? [...updated[index].question_sub_divisions] : [];
        while (currentList.length < numQ) {
          const fallback = updated[index].sub_division === 'none' ? 'none' : 'two_subquestions';
          currentList.push(fallback);
        }
        updated[index].question_sub_divisions = currentList.slice(0, numQ);

        const allTwo = updated[index].question_sub_divisions.every(v => v === 'two_subquestions');
        const allNone = updated[index].question_sub_divisions.every(v => v === 'none');
        if (allTwo) updated[index].sub_division = 'two_subquestions';
        else if (allNone) updated[index].sub_division = 'none';
        else updated[index].sub_division = 'mixed';
      }

      // Sync question_cos length
      const currentCos = Array.isArray(updated[index].question_cos) ? [...updated[index].question_cos] : [];
      while (currentCos.length < numQ) {
        currentCos.push('auto');
      }
      updated[index].question_cos = currentCos.slice(0, numQ);

      // Sync question_blooms length
      const currentBlooms = Array.isArray(updated[index].question_blooms) ? [...updated[index].question_blooms] : [];
      while (currentBlooms.length < numQ) {
        currentBlooms.push('auto');
      }
      updated[index].question_blooms = currentBlooms.slice(0, numQ);
    }

    setSections(updated);
  };

  const handleUpdateQuestionSubDivision = (sectionIdx, qIdx, value) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const currentList = Array.isArray(sec.question_sub_divisions) ? [...sec.question_sub_divisions] : [];
    while (currentList.length < numQ) {
      currentList.push('two_subquestions');
    }
    currentList[qIdx] = value;
    sec.question_sub_divisions = currentList;

    const allTwo = currentList.every(v => v === 'two_subquestions');
    const allNone = currentList.every(v => v === 'none');
    if (allTwo) sec.sub_division = 'two_subquestions';
    else if (allNone) sec.sub_division = 'none';
    else sec.sub_division = 'mixed';

    setSections(updated);
  };

  const handleUpdateQuestionMark = (sectionIdx, qIdx, key, val) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const currentMarksList = Array.isArray(sec.question_sub_marks) ? [...sec.question_sub_marks] : [];
    while (currentMarksList.length < numQ) {
      currentMarksList.push(getQuestionMarks(sec, currentMarksList.length));
    }
    const currentObj = { ...getQuestionMarks(sec, qIdx) };
    const targetMarks = Math.max(2, parseInt(sec.marks_per_q) || 14);
    const rawVal = parseInt(val) || 0;

    if (key === 'q1_a') {
      const clamped = Math.min(Math.max(1, rawVal), Math.max(1, targetMarks - 1));
      currentObj.q1_a = clamped;
      currentObj.q1_b = Math.max(1, targetMarks - clamped);
      // Auto-mirror symmetrical pair by default
      currentObj.q2_a = currentObj.q1_a;
      currentObj.q2_b = currentObj.q1_b;
    } else if (key === 'q1_b') {
      const clamped = Math.min(Math.max(1, rawVal), Math.max(1, targetMarks - 1));
      currentObj.q1_b = clamped;
      currentObj.q1_a = Math.max(1, targetMarks - clamped);
      // Auto-mirror symmetrical pair by default
      currentObj.q2_b = currentObj.q1_b;
      currentObj.q2_a = currentObj.q1_a;
    } else if (key === 'q2_a') {
      const clamped = Math.min(Math.max(1, rawVal), Math.max(1, targetMarks - 1));
      currentObj.q2_a = clamped;
      currentObj.q2_b = Math.max(1, targetMarks - clamped);
    } else if (key === 'q2_b') {
      const clamped = Math.min(Math.max(1, rawVal), Math.max(1, targetMarks - 1));
      currentObj.q2_b = clamped;
      currentObj.q2_a = Math.max(1, targetMarks - clamped);
    } else {
      const numVal = Math.max(1, rawVal || 1);
      currentObj[key] = numVal;
      if (key === 'q1') currentObj.q2 = numVal;
    }

    currentMarksList[qIdx] = currentObj;
    sec.question_sub_marks = currentMarksList;
    setSections(updated);
  };

  const handleUpdateQuestionCO = (sectionIdx, qIdx, key, val) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const currentCosList = Array.isArray(sec.question_cos) ? [...sec.question_cos] : [];
    while (currentCosList.length < numQ) {
      currentCosList.push(getQuestionCOs(sec, currentCosList.length));
    }
    const currentObj = { ...getQuestionCOs(sec, qIdx) };
    currentObj[key] = val;
    // For single question without key, set both
    if (key === 'q1' && currentObj.q2 === 'auto') currentObj.q2 = val;

    currentCosList[qIdx] = currentObj;
    sec.question_cos = currentCosList;
    setSections(updated);
  };

  const handleSetAllSubQuestionsPattern = (sectionIdx, aMarks = 8, bMarks = 6) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    sec.sub_division = 'two_subquestions';
    sec.question_sub_divisions = new Array(numQ).fill('two_subquestions');
    sec.marks_per_q = aMarks + bMarks;
    sec.question_sub_marks = Array.from({ length: numQ }).map(() => ({
      q1_a: aMarks,
      q1_b: bMarks,
      q2_a: aMarks,
      q2_b: bMarks,
      q1: aMarks + bMarks,
      q2: aMarks + bMarks
    }));
    setSections(updated);
    showNotification(`Section configured: All questions set to 2 Sub-questions (${aMarks}M + ${bMarks}M pattern).`);
  };

  const handleSetAllSingleQuestions = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const baseM = parseInt(sec.marks_per_q) || 14;
    sec.sub_division = 'none';
    sec.question_sub_divisions = new Array(numQ).fill('none');
    sec.question_sub_marks = Array.from({ length: numQ }).map(() => ({
      q1: baseM,
      q2: baseM,
      q1_a: Math.ceil(baseM / 2),
      q1_b: baseM - Math.ceil(baseM / 2),
      q2_a: Math.ceil(baseM / 2),
      q2_b: baseM - Math.ceil(baseM / 2)
    }));
    setSections(updated);
    showNotification(`Section configured: All questions set to Single Questions (${baseM}M).`);
  };

  const handleAutoDistributeSectionCOs = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const coList = outcomes && outcomes.length > 0 ? outcomes.map(o => o.id) : ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'];
    const distributed = [];
    
    let coCursor = 0;
    for (let i = 0; i < numQ; i++) {
      const co_1_a = coList[coCursor % coList.length];
      coCursor++;
      const co_1_b = coList[coCursor % coList.length];
      coCursor++;
      const co_2_a = co_1_a;
      const co_2_b = co_1_b;

      distributed.push({
        q1: co_1_a,
        q2: co_2_a,
        q1_a: co_1_a,
        q1_b: co_1_b,
        q2_a: co_2_a,
        q2_b: co_2_b
      });
    }
    sec.question_cos = distributed;
    setSections(updated);
    showNotification(`Auto-distributed COs evenly across sub-questions (a & b) for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleResetSectionCOs = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    sec.question_cos = new Array(numQ).fill({
      q1: 'auto',
      q2: 'auto',
      q1_a: 'auto',
      q1_b: 'auto',
      q2_a: 'auto',
      q2_b: 'auto'
    });
    setSections(updated);
    showNotification(`Reset all question target COs to Auto for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleUpdateQuestionBloom = (sectionIdx, qIdx, key, val) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const currentBloomsList = Array.isArray(sec.question_blooms) ? [...sec.question_blooms] : [];
    while (currentBloomsList.length < numQ) {
      currentBloomsList.push(getQuestionBlooms(sec, currentBloomsList.length));
    }
    const currentObj = { ...getQuestionBlooms(sec, qIdx) };
    currentObj[key] = val;
    if (key === 'q1' && currentObj.q2 === 'auto') currentObj.q2 = val;

    currentBloomsList[qIdx] = currentObj;
    sec.question_blooms = currentBloomsList;
    setSections(updated);
  };

  const handleAutoDistributeSectionBlooms = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const activeBlooms = (blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS.map(b => b.value)).map(b => typeof b === 'object' ? b.value : b);
    const distributed = [];

    let bCursor = 0;
    for (let i = 0; i < numQ; i++) {
      const b_1_a = activeBlooms[bCursor % activeBlooms.length];
      bCursor++;
      const b_1_b = activeBlooms[bCursor % activeBlooms.length];
      bCursor++;
      const b_2_a = b_1_a;
      const b_2_b = b_1_b;

      distributed.push({
        q1: b_1_a,
        q2: b_2_a,
        q1_a: b_1_a,
        q1_b: b_1_b,
        q2_a: b_2_a,
        q2_b: b_2_b
      });
    }
    sec.question_blooms = distributed;
    setSections(updated);
    showNotification(`Auto-distributed Bloom levels evenly across questions for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleResetSectionBlooms = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    sec.question_blooms = new Array(numQ).fill({
      q1: 'auto',
      q2: 'auto',
      q1_a: 'auto',
      q1_b: 'auto',
      q2_a: 'auto',
      q2_b: 'auto'
    });
    setSections(updated);
    showNotification(`Reset all question target Bloom levels to Auto for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleDeleteSection = (index) => {
    if (sections.length <= 1) {
      showNotification('Exam blueprint must contain at least one section', 'error');
      return;
    }
    setSections(sections.filter((_, i) => i !== index));
  };

  // --- AUTOMATIC COURSE OUTCOME (CO) EXTRACTION ---
  const handleExtractCOsFromDocuments = async () => {
    if (!selectedCourse && selectedDocIds.length === 0 && !materialText.trim()) {
      showNotification('Please select a course or reference documents first', 'error');
      return;
    }

    setExtractingCOs(true);
    setCoDetectionStatus('idle');
    try {
      const payload = {
        course_id: selectedCourse ? parseInt(selectedCourse) : null,
        document_ids: selectedDocIds,
        material_text: materialText
      };

      const res = await qpService.extractCOs(payload);
      if (res.success && res.found && res.outcomes && res.outcomes.length > 0) {
        setOutcomes(res.outcomes);
        if (res.units && res.units.length > 0) {
          setTopics(res.units);
        }
        setCoDetectionStatus('found');
        setCoSourceInfo(res.source_type === 'document' ? 'Extracted directly from Document' : 'Synthesized from Syllabus Units');
        setNewCoId(`CO${res.outcomes.length + 1}`);
        showNotification(res.message || `✓ Automatically configured ${res.outcomes.length} Course Outcomes and Units!`);
      } else {
        setCoDetectionStatus('not_found');
        showNotification(
          res.message || '⚠️ No Course Outcomes detected in the uploaded documents. Please add them manually or click Auto-Generate.',
          'error'
        );
      }
    } catch (err) {
      setCoDetectionStatus('not_found');
      showNotification(err.message || 'Failed to extract Course Outcomes from materials', 'error');
    } finally {
      setExtractingCOs(false);
    }
  };

  // Auto-generate syllabus-aligned COs based on course
  const handleAutoGenerateCOsFromCourse = async () => {
    if (!selectedCourse && selectedDocIds.length === 0 && !materialText.trim()) {
      showNotification('Please select a course or reference documents first', 'error');
      return;
    }

    setExtractingCOs(true);
    setCoDetectionStatus('idle');
    try {
      const payload = {
        course_id: selectedCourse ? parseInt(selectedCourse) : null,
        document_ids: selectedDocIds,
        material_text: materialText,
        force_synthesize: true
      };

      const res = await qpService.extractCOs(payload);
      if (res.success && res.outcomes && res.outcomes.length > 0) {
        setOutcomes(res.outcomes);
        if (res.units && res.units.length > 0) {
          setTopics(res.units);
        }
        setCoDetectionStatus('found');
        setCoSourceInfo('Synthesized from Syllabus Units & Topics');
        setNewCoId(`CO${res.outcomes.length + 1}`);
        showNotification(res.message || `🪄 Synthesized 6 syllabus-grounded Course Outcomes!`);
      } else {
        const currentCourse = courses.find(c => String(c.id) === String(selectedCourse));
        const cName = currentCourse ? currentCourse.course_name : 'the course domain';
        const generated = [
          { id: 'CO1', description: `Explain foundational principles, architectural models, and core concepts in ${cName}`, bloom_level: 'Understand', unit: 'Unit 1' },
          { id: 'CO2', description: `Apply design patterns, methods, and practical frameworks to solve standard problems in ${cName}`, bloom_level: 'Apply', unit: 'Unit 2' },
          { id: 'CO3', description: `Analyze component hierarchies, data structures, and computational workflows in ${cName}`, bloom_level: 'Analyze', unit: 'Unit 3' },
          { id: 'CO4', description: `Evaluate error handling, synchronization, resource constraints, and performance bottlenecks in ${cName}`, bloom_level: 'Evaluate', unit: 'Unit 4' },
          { id: 'CO5', description: `Synthesize modular and scalable solutions adhering to industry specifications for ${cName}`, bloom_level: 'Create', unit: 'Unit 4' },
          { id: 'CO6', description: `Design advanced system implementations, emerging techniques, and architectural optimizations for ${cName}`, bloom_level: 'Create', unit: 'Unit 4' }
        ];
        setOutcomes(generated);
        setCoDetectionStatus('found');
        setCoSourceInfo('Standard Course Outcomes');
        setNewCoId('CO7');
        showNotification(`🪄 Populated standard Course Outcomes for ${cName}!`);
      }
    } catch (err) {
      showNotification(err.message || 'Failed to synthesize Course Outcomes', 'error');
    } finally {
      setExtractingCOs(false);
    }
  };

  // Outcomes Management Handlers
  const handleAddOutcome = () => {
    if (!newCoDesc.trim()) {
      showNotification('Please enter Course Outcome description', 'error');
      return;
    }
    const newCo = {
      id: newCoId.trim() || `CO${outcomes.length + 1}`,
      description: newCoDesc.trim(),
      bloom_level: newCoBloom || 'Understand',
      unit: newCoUnit || 'Unit 1'
    };
    setOutcomes([...outcomes, newCo]);
    setNewCoId(`CO${outcomes.length + 2}`);
    setNewCoDesc('');
    setCoDetectionStatus('found');
    showNotification(`Added Course Outcome: ${newCo.id}`);
  };

  const handleDeleteOutcome = (index) => {
    if (outcomes.length <= 1) {
      showNotification('Exam blueprint must retain at least one Course Outcome', 'error');
      return;
    }
    setOutcomes(outcomes.filter((_, i) => i !== index));
  };

  const handleUpdateOutcomeText = (index, field, value) => {
    const updated = [...outcomes];
    updated[index][field] = value;
    setOutcomes(updated);
  };

  const handleResetOutcomes = () => {
    setOutcomes(DEFAULT_COS);
    setNewCoId('CO7');
    setCoDetectionStatus('idle');
    showNotification('Reset to standard Bloom-mapped Course Outcomes');
  };

  // Dynamic Units & Topics Extraction Handlers
  const handleExtractUnitsFromDocuments = async () => {
    if (!selectedCourse && selectedDocIds.length === 0 && !materialText.trim()) {
      showNotification('Please select a course or reference documents first', 'error');
      return;
    }

    setExtractingUnits(true);
    try {
      const payload = {
        course_id: selectedCourse ? parseInt(selectedCourse) : null,
        document_ids: selectedDocIds,
        pasted_text: materialText
      };

      const res = await qpService.extractUnits(payload);
      if (res.success && res.units && res.units.length > 0) {
        setTopics(res.units);
        const totalTop = res.units.reduce((acc, u) => acc + (u.topics?.length || 0), 0);
        showNotification(res.message || `✓ Extracted ${res.units.length} units and ${totalTop} topics from syllabus document!`);
      } else {
        showNotification(res.message || '⚠️ No units detected. Standard units populated.', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to extract curriculum units', 'error');
    } finally {
      setExtractingUnits(false);
    }
  };

  const handleUpdateUnitTitle = (unitIdx, title) => {
    const updated = [...topics];
    updated[unitIdx].unit_title = title;
    updated[unitIdx].name = `${updated[unitIdx].unit_label || updated[unitIdx].unit_key}: ${title}`;
    setTopics(updated);
  };

  const handleAddConceptToUnit = (unitIdx) => {
    const val = (unitConceptInputs[unitIdx] || '').trim();
    if (!val) return;
    const updated = [...topics];
    if (!Array.isArray(updated[unitIdx].topics)) {
      updated[unitIdx].topics = [];
    }
    if (!updated[unitIdx].topics.includes(val)) {
      updated[unitIdx].topics.push(val);
      setTopics(updated);
      setUnitConceptInputs(prev => ({ ...prev, [unitIdx]: '' }));
      showNotification(`Added topic "${val}" to ${updated[unitIdx].unit_label || updated[unitIdx].unit_key}`);
    } else {
      showNotification('Topic already exists in this unit', 'error');
    }
  };

  const handleDeleteConceptFromUnit = (unitIdx, conceptIdx) => {
    const updated = [...topics];
    if (Array.isArray(updated[unitIdx].topics)) {
      updated[unitIdx].topics = updated[unitIdx].topics.filter((_, i) => i !== conceptIdx);
      setTopics(updated);
    }
  };

  const handleDeleteTopic = (index) => {
    if (topics.length <= 1) {
      showNotification('Exam blueprint must contain at least one unit', 'error');
      return;
    }
    const updated = topics.filter((_, i) => i !== index);
    const baseW = Math.floor(100 / updated.length);
    const rem = 100 - (baseW * updated.length);
    updated.forEach((u, i) => {
      u.weight = baseW + (i === updated.length - 1 ? rem : 0);
    });
    setTopics(updated);
  };

  const handleUpdateTopicWeight = (index, weight) => {
    const updated = [...topics];
    updated[index].weight = Math.max(1, parseInt(weight) || 1);
    setTopics(updated);
  };

  const handleAddCustomUnit = (unitLabel, unitTitle, hours, weight) => {
    const nextIdx = topics.length + 1;
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][topics.length] || String(nextIdx);
    const newU = {
      id: nextIdx,
      unit_key: `Unit ${nextIdx}`,
      unit_label: unitLabel || `Unit-${roman}`,
      unit_title: unitTitle || `Advanced Topic Area ${nextIdx}`,
      name: `${unitLabel || `Unit-${roman}`}: ${unitTitle || `Advanced Topic Area ${nextIdx}`}`,
      hours: hours || '10 Hours',
      weight: parseInt(weight) || 20,
      topics: ['Fundamental Concepts', 'Implementation Details']
    };
    setTopics([...topics, newU]);
    showNotification(`Added ${newU.unit_label}`);
  };

  const handlePreloadDefaultTopics = () => {
    const currentCourse = courses.find(c => String(c.id) === String(selectedCourse));
    const courseName = currentCourse ? currentCourse.course_name : 'Computer Science';
    setTopics([
      {
        id: 1,
        unit_key: 'Unit 1',
        unit_label: 'Unit-I',
        unit_title: `${courseName}: Foundations & Core Architecture`,
        name: `Unit-I: ${courseName}: Foundations & Core Architecture`,
        hours: '11 Hours',
        weight: 25,
        topics: ['System Fundamentals', 'Architectural Principles', 'Core Protocols', 'Runtime Environments']
      },
      {
        id: 2,
        unit_key: 'Unit 2',
        unit_label: 'Unit-II',
        unit_title: `${courseName}: Data Models & Practical Paradigms`,
        name: `Unit-II: ${courseName}: Data Models & Practical Paradigms`,
        hours: '13 Hours',
        weight: 25,
        topics: ['Data Modeling', 'Structural Patterns', 'Query Processing', 'State Handling']
      },
      {
        id: 3,
        unit_key: 'Unit 3',
        unit_label: 'Unit-III',
        unit_title: `${courseName}: Component Implementations & Storage`,
        name: `Unit-III: ${courseName}: Component Implementations & Storage`,
        hours: '13 Hours',
        weight: 25,
        topics: ['Component Architecture', 'CRUD Operations', 'Storage Subsystems', 'API Handlers']
      },
      {
        id: 4,
        unit_key: 'Unit 4',
        unit_label: 'Unit-IV',
        unit_title: `${courseName}: Security, Communication & Optimization`,
        name: `Unit-IV: ${courseName}: Security, Communication & Optimization`,
        hours: '11 Hours',
        weight: 25,
        topics: ['Network Protocols', 'Security Controls', 'Performance Optimization', 'Fault Tolerance']
      }
    ]);
    showNotification(`Preloaded 4 standardized curriculum units for ${courseName}!`);
  };

  // Difficulty Sliders Handling
  const handleDifficultyChange = (type, val) => {
    const parsed = Math.max(0, Math.min(100, parseInt(val) || 0));
    setDifficulty(prev => ({ ...prev, [type]: parsed }));
  };

  // Bloom's Taxonomy dynamic handlers
  const handleAddCustomBloom = (name) => {
    const cleanName = (name || customBloomInput).trim();
    if (!cleanName) return;
    if (!blooms.includes(cleanName)) {
      setBlooms(prev => [...prev, cleanName]);
    }
    if (!selectedBlooms.includes(cleanName)) {
      setSelectedBlooms(prev => [...prev, cleanName]);
    }
    setCustomBloomInput('');
    setBloomDropdownSelect('');
    showNotification(`Added Bloom's level: "${cleanName}" to active blueprint`);
  };

  const handleBloomDropdownChange = (e) => {
    const val = e.target.value;
    if (val) handleAddCustomBloom(val);
  };

  const toggleBloom = (bloom) => {
    setSelectedBlooms(prev =>
      prev.includes(bloom) ? prev.filter(b => b !== bloom) : [...prev, bloom]
    );
  };

  const handleRemoveBloom = (bloom, e) => {
    e.stopPropagation();
    setBlooms(prev => prev.filter(b => b !== bloom));
    setSelectedBlooms(prev => prev.filter(b => b !== bloom));
  };

  // --- SYNTHESIZE QUESTION PAPER ---
  const handleGenerate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedCourse) {
      showNotification('Please select a course to generate question paper', 'error');
      setActiveTab('details');
      return;
    }

    setGenerating(true);
    setGeneratedPaper(null);
    setSavedPaper(null);

    try {
      const payload = {
        course_id: parseInt(selectedCourse),
        document_ids: selectedDocIds,
        pasted_text: materialText,
        title,
        institution_name: institutionName,
        academic_year: academicYear,
        sem: parseInt(sem),
        total_marks: totalCalculatedMarks,
        duration,
        exam_date: formatExamDate(examDate),
        special_instructions: specialInstructions,
        sections: sections
          .filter(s => s.type !== 'None')
          .map((s, activeIdx) => {
            const numQ = parseInt(s.questions) || 1;
            return {
              name: `Section ${String.fromCharCode(65 + activeIdx)}`,
              type: s.type,
              questions: numQ,
              marks_per_q: s.marks_per_q,
              choice_mode: s.choice_mode || 'none',
              sub_division: s.sub_division || (s.type === 'Long Answer' ? 'two_subquestions' : 'none'),
              question_sub_divisions: Array.from({ length: numQ }).map((_, qIdx) => getQuestionSubDivision(s, qIdx)),
              question_sub_marks: Array.from({ length: numQ }).map((_, qIdx) => getQuestionMarks(s, qIdx)),
              question_cos: Array.from({ length: numQ }).map((_, qIdx) => getQuestionCOs(s, qIdx)),
              question_blooms: Array.from({ length: numQ }).map((_, qIdx) => getQuestionBlooms(s, qIdx))
            };
          }),
        topics: topics.map(t => ({
          id: t.id,
          unit_key: t.unit_key || (t.id ? `Unit ${t.id}` : undefined),
          unit_label: t.unit_label || (t.id ? `Unit ${t.id}` : undefined),
          unit_title: t.unit_title || t.name,
          name: t.name || (t.unit_title ? `${t.unit_label || t.unit_key || ''}: ${t.unit_title}` : `Topic ${t.id}`),
          hours: t.hours || '',
          weight: parseInt(t.weight) || 25,
          topics: Array.isArray(t.topics) ? t.topics : []
        })),
        outcomes: outcomes.map(o => ({ id: o.id, description: o.description, bloom_level: o.bloom_level, unit: o.unit })),
        blooms: selectedBlooms,
        difficulty: difficulty
      };

      const res = await qpService.generate(payload);
      if (res.success) {
        setGeneratedPaper(res.data);
        showNotification('✨ Question Paper generated successfully! Review below.');
        setTimeout(() => {
          const el = document.getElementById('generated-paper-preview');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch (err) {
      showNotification(err.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Save Generated Paper to Archives
  const handleSaveToArchive = async () => {
    if (!generatedPaper) return;
    setSaving(true);
    try {
      const payload = {
        course_id: parseInt(selectedCourse),
        course_name: generatedPaper.course_name,
        course_code: generatedPaper.course_code,
        title: generatedPaper.title,
        academic_year: generatedPaper.academic_year,
        semester: generatedPaper.semester,
        total_marks: generatedPaper.total_marks,
        duration: generatedPaper.duration,
        paper_schema: {
          sections: sections.filter(s => s.type !== 'None').map((s, activeIdx) => ({
            ...s,
            name: `Section ${String.fromCharCode(65 + activeIdx)}`
          })),
          outcomes: outcomes,
          blooms: selectedBlooms,
          difficulty: difficulty,
          documents_referenced: selectedDocIds
        },
        generated_content: generatedPaper
      };

      const res = await qpService.save(payload);
      if (res.success) {
        const fullPaper = {
          ...res.data,
          title: res.data.title || generatedPaper.title || title,
          course_name: res.data.course_name || generatedPaper.course_name,
          course_code: res.data.course_code || generatedPaper.course_code,
          total_marks: res.data.total_marks || generatedPaper.total_marks || totalCalculatedMarks
        };
        setSavedPaper(fullPaper);
        showNotification('Question Paper successfully saved to department archives! You can now password-protect it.');
        return fullPaper;
      }
    } catch (err) {
      showNotification(err.message || 'Failed to save paper', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProtectModal = async () => {
    if (!savedPaper) {
      const saved = await handleSaveToArchive();
      if (saved && saved.id) {
        setShowProtectModal(true);
      }
    } else {
      setShowProtectModal(true);
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const originalOverflow = document.body.style.overflow;
    if (generatedPaper) {
      const sanitizedCourse = (generatedPaper.course_code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedTitle = (generatedPaper.title || 'Question_Paper').replace(/[^a-zA-Z0-9_-]/g, '_');
      document.title = `${sanitizedCourse}_${sanitizedTitle}`;
    }
    document.body.style.overflow = 'visible';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
      document.body.style.overflow = originalOverflow;
    }, 1500);
  };

  const handleQuestionTextChange = (sectionIdx, qIdx, newText) => {
    setGeneratedPaper(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      updated.sections[sectionIdx].questions[qIdx].question = newText;
      return updated;
    });
  };

  const handleQuestionCOChange = (sectionIdx, qIdx, newCo, part = null) => {
    setGeneratedPaper(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      const targetQ = updated.sections?.[sectionIdx]?.questions?.[qIdx];
      if (targetQ) {
        if (part === 'q1') {
          targetQ.q1_co = newCo;
          targetQ.co = newCo;
        } else if (part === 'q2') {
          targetQ.q2_co = newCo;
        } else {
          targetQ.co = newCo;
          targetQ.q1_co = newCo;
        }
      }

      // Dynamically recalculate Course Outcomes (CO) Coverage Matrix
      const coMap = {};
      (outcomes || []).forEach(oc => {
        coMap[oc.id] = {
          id: oc.id,
          description: oc.description || '',
          bloom_level: oc.bloom_level || 'Understand',
          unit: oc.unit || 'Unit 1',
          marks: 0,
          question_count: 0,
          question_numbers: []
        };
      });

      // Recalculate marks and question mappings across all sections
      (updated.sections || []).forEach(sec => {
        (sec.questions || []).forEach(q => {
          const qMarks = parseInt(q.marks || 0);

          if (q.has_internal_choice && q.q1_no && q.q2_no) {
            const q1Co = q.q1_co || q.co;
            const q2Co = q.q2_co || q.co;
            const q1Label = `Q${String(q.q1_no).replace(/^Q\s*/i, '')}`;
            const q2Label = `Q${String(q.q2_no).replace(/^Q\s*/i, '')}`;

            if (q1Co) {
              if (!coMap[q1Co]) {
                coMap[q1Co] = {
                  id: q1Co,
                  description: q.co_description || '',
                  bloom_level: q.bloom_level || 'Understand',
                  unit: q.unit || 'Unit 1',
                  marks: 0,
                  question_count: 0,
                  question_numbers: []
                };
              }
              coMap[q1Co].marks += qMarks;
              coMap[q1Co].question_count += 1;
              if (!coMap[q1Co].question_numbers.includes(q1Label)) {
                coMap[q1Co].question_numbers.push(q1Label);
              }
            }

            if (q2Co && q2Co !== q1Co) {
              if (!coMap[q2Co]) {
                coMap[q2Co] = {
                  id: q2Co,
                  description: q.co_description || '',
                  bloom_level: q.bloom_level || 'Understand',
                  unit: q.unit || 'Unit 1',
                  marks: 0,
                  question_count: 0,
                  question_numbers: []
                };
              }
              coMap[q2Co].marks += qMarks;
              coMap[q2Co].question_count += 1;
              if (!coMap[q2Co].question_numbers.includes(q2Label)) {
                coMap[q2Co].question_numbers.push(q2Label);
              }
            } else if (q2Co && q2Co === q1Co) {
              if (!coMap[q1Co].question_numbers.includes(q2Label)) {
                coMap[q1Co].question_numbers.push(q2Label);
              }
            }
          } else {
            const qCo = q.co;
            let qNum = q.q_no;
            if (qNum) {
              qNum = `Q${String(qNum).replace(/^Q\s*/i, '')}`;
            }

            if (qCo) {
              if (!coMap[qCo]) {
                coMap[qCo] = {
                  id: qCo,
                  description: q.co_description || '',
                  bloom_level: q.bloom_level || 'Understand',
                  unit: q.unit || 'Unit 1',
                  marks: 0,
                  question_count: 0,
                  question_numbers: []
                };
              }
              coMap[qCo].marks += qMarks;
              coMap[qCo].question_count += 1;
              if (qNum && !coMap[qCo].question_numbers.includes(qNum)) {
                coMap[qCo].question_numbers.push(qNum);
              }
            }
          }
        });
      });

      updated.co_matrix = Object.values(coMap);
      return updated;
    });
  };

  const courseOptions = courses
    .filter(c => c.status === 1)
    .map(c => ({
      value: c.id,
      label: `${c.course_name} (${c.course_code}) - Sem ${c.sem || '1'}`
    }));

  return (
    <div>
      {/* Top Title Bar */}
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧠</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              ExamForge AI <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent-cyan)' }}>• Blueprint Designer</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Configure examination blueprints and synthesize questions directly aligned with Course Outcomes (COs) and Syllabus.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/hod/papers')}>
          🗄️ View Saved Papers
        </button>
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: 'var(--status-active)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: 'var(--status-inactive)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Blueprint Designer Card */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '32px' }}>
        <div className="blueprint-header-title">
          <span>🎛️</span>
          <span>Blueprint Designer</span>
        </div>

        {/* 5-Tab Navigation Header */}
        <div className="blueprint-tabs-nav">
          <button
            type="button"
            className={`blueprint-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📋 Details
          </button>
          <button
            type="button"
            className={`blueprint-tab-btn ${activeTab === 'structure' ? 'active' : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            🎛️ Structure
          </button>
          <button
            type="button"
            className={`blueprint-tab-btn ${activeTab === 'outcomes' ? 'active' : ''}`}
            onClick={() => setActiveTab('outcomes')}
          >
            🎯 Course Outcomes ({outcomes.length})
          </button>
          <button
            type="button"
            className={`blueprint-tab-btn ${activeTab === 'topics' ? 'active' : ''}`}
            onClick={() => setActiveTab('topics')}
          >
            📖 Topics & Units ({topics.length})
          </button>
          <button
            type="button"
            className={`blueprint-tab-btn ${activeTab === 'difficulty' ? 'active' : ''}`}
            onClick={() => setActiveTab('difficulty')}
          >
            🧠 Difficulty & Blooms
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
              <FormInput
                label="Institution/University Name"
                name="institutionName"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Grand National Tech University"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <SelectInput
                label="Examination Title"
                name="title"
                value={title}
                onChange={(e) => handleExamTitleChange(e.target.value)}
                options={EXAM_TITLES}
                placeholder="Select Examination Title"
                required
              />
              <SelectInput
                label="Course Title & Code"
                name="selectedCourse"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                options={courseOptions}
                placeholder="Choose available course"
                required
              />
            </div>

            {/* Course Materials Live Database Fetch Status Section */}
            {selectedCourse && (
              <div style={{
                backgroundColor: courseDocuments.length > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                border: `1px solid ${courseDocuments.length > 0 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
                borderRadius: 'var(--border-radius)',
                padding: '14px 18px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{loadingDocs ? '⏳' : courseDocuments.length > 0 ? '📚' : '📂'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: courseDocuments.length > 0 ? '#60a5fa' : '#facc15' }}>
                        {loadingDocs
                          ? 'Fetching course materials from database...'
                          : courseDocuments.length > 0
                          ? `Database Synced: ${courseDocuments.length} Course Document${courseDocuments.length > 1 ? 's' : ''} Automatically Fetched for ${courses.find(c => String(c.id) === String(selectedCourse))?.course_name || 'Selected Course'}`
                          : `No course materials stored in database for this course`}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {courseDocuments.length > 0
                          ? `Total indexed text: ${courseDocuments.reduce((sum, d) => sum + (d.text_length || 0), 0).toLocaleString()} characters across ${courseDocuments.length} document(s) in DB.`
                          : `Course documents are managed by Admin in Course Management.`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {courseDocuments.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleExtractCOsFromDocuments}
                        disabled={extractingCOs}
                        style={{ fontSize: '0.82rem', padding: '5px 12px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                        title="Automatically detect and extract Course Outcomes (COs) from the fetched database documents"
                      >
                        {extractingCOs ? 'Analyzing Documents...' : '⚡ Extract COs from Documents'}
                      </button>
                    )}
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: courseDocuments.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: courseDocuments.length > 0 ? '#34d399' : '#facc15',
                      border: `1px solid ${courseDocuments.length > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
                    }}>
                      {courseDocuments.length > 0 ? '✓ Synced with Database' : 'No DB Docs'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <FormInput
                label="Duration"
                name="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3 Hours"
                required
              />
              <FormInput
                label="Exam Date (Select Date)"
                name="examDate"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                title="Click calendar icon to select exam date"
                required
              />
              <SelectInput
                label="Semester"
                name="sem"
                value={sem}
                onChange={(e) => setSem(e.target.value)}
                options={SEMESTERS}
                required
              />
              <FormInput
                label="Academic Year (Locked)"
                name="academicYear"
                value={academicYear}
                disabled={true}
                readOnly={true}
                title="Academic year is determined automatically from system date and cannot be modified"
                style={{ opacity: 0.8, cursor: 'not-allowed', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Total Marks (Auto-Generated / Read-Only)</label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  padding: '12px 16px',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🔢</span>
                  <span>{totalCalculatedMarks} Marks</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 400, marginLeft: 'auto' }}>
                    Auto-synced for {title}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Special Instructions</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Instructions printed on exam paper header..."
                />
              </div>
            </div>

            {/* Syllabus & Course Materials Ingestion */}
            <div className="syllabus-materials-panel">
              <div className="syllabus-panel-header">
                <div className="syllabus-panel-icon">
                  <span>📄</span>
                </div>
                <h3 className="syllabus-panel-title">Syllabus & Course Materials (Auto-Fetched from DB)</h3>
              </div>

              {/* Reference Documents Browser */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9' }}>
                      <span>📚</span>
                      <span>Available Reference Documents ({docScope === 'course' ? courseDocuments.length : allDocuments.length})</span>
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                      Select one document at a time to generate the examination paper.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => setDocScope('course')}
                        style={{
                          background: docScope === 'course' ? '#3b82f6' : 'transparent',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Selected Course ({courseDocuments.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocScope('all')}
                        style={{
                          background: docScope === 'all' ? '#3b82f6' : 'transparent',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        All Uploaded ({allDocuments.length})
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleClearDocSelections}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                        title="Deselect document"
                      >
                        ✕ Clear
                      </button>
                    </div>

                    <span style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: selectedDocIds.length > 0 ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedDocIds.length > 0 ? '#60a5fa' : 'var(--text-secondary)',
                      border: selectedDocIds.length > 0 ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-color)'
                    }}>
                      {selectedDocIds.length > 0 ? '1 Document Selected for AI' : 'Select 1 Document for AI'}
                    </span>
                  </div>
                </div>

                {/* Document Cards Grid */}
                {(docScope === 'course' ? courseDocuments : allDocuments).length === 0 ? (
                  <div style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.86rem',
                    padding: '14px 18px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}>
                    ℹ️ No uploaded reference files found in this category.
                  </div>
                ) : (
                  <div className="doc-selection-grid">
                    {(docScope === 'course' ? courseDocuments : allDocuments).map(doc => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`doc-selection-card ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => toggleDocSelection(doc.id, e)}
                          title={isSelected ? 'Click to deselect' : 'Click to select this document for AI question generation'}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, marginRight: '6px' }}>
                                <input
                                  type="radio"
                                  name="selectedDoc"
                                  checked={isSelected}
                                  onChange={(e) => toggleDocSelection(doc.id, e)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: 'pointer', width: '18px', height: '18px', marginTop: '2px', accentColor: '#3b82f6' }}
                                />
                                <div>
                                  <div style={{
                                    fontWeight: 700,
                                    fontSize: '0.94rem',
                                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                                    lineHeight: 1.3
                                  }}>
                                    📄 {doc.title}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                    👤 {doc.course_name ? `${doc.course_name} • ` : ''}Uploaded by: <strong style={{ color: 'var(--text-primary)' }}>{doc.user_name || 'Faculty'}</strong>
                                  </div>
                                </div>
                              </div>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: doc.file_type === 'pdf' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                                color: doc.file_type === 'pdf' ? '#f87171' : '#60a5fa',
                                border: doc.file_type === 'pdf' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)'
                              }}>
                                {doc.file_type}
                              </span>
                            </div>

                            {doc.text_length > 0 && (
                              <div style={{ fontSize: '0.76rem', color: 'var(--status-active, #10b981)', marginLeft: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>✓</span>
                                <span>{doc.text_length.toLocaleString()} characters indexed</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <span style={{
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              color: isSelected ? '#38bdf8' : 'var(--text-muted)'
                            }}>
                              {isSelected ? '✓ Selected for AI' : '+ Click to Select'}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => handleOpenInspect(doc, e)}
                              style={{ fontSize: '0.76rem', padding: '3px 10px' }}
                              title="Inspect extracted text from this file"
                            >
                              👁️ Inspect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STRUCTURE & SUB-DIVISIONS */}
        {activeTab === 'structure' && (
          <div>
            <div className="blueprint-calc-banner">
              <span>🧮</span>
              <span>Total marks are automatically calculated: <strong>{totalCalculatedMarks} Marks</strong>.</span>
            </div>

            {sections.map((sec, sIdx) => {
              const isNone = sec.type === 'None';
              const dynamicName = getDynamicSectionName(sections, sIdx);
              const qRange = getSectionQuestionRange(sections, sIdx);
              const marksPerQ = parseInt(sec.marks_per_q) || 10;
              const numQuestions = parseInt(sec.questions) || 1;
              const subtotal = isNone ? 0 : numQuestions * marksPerQ;

              return (
                <div
                  key={sec.id}
                  className="blueprint-section-card"
                  style={{
                    opacity: isNone ? 0.65 : 1,
                    border: isNone ? '1px dashed rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                    background: isNone ? 'rgba(15, 23, 42, 0.3)' : undefined,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="blueprint-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div
                        className="blueprint-section-title"
                        style={{ color: isNone ? 'var(--text-muted)' : 'var(--text-primary)' }}
                      >
                        {dynamicName}
                      </div>

                      {!isNone && (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(59, 130, 246, 0.18)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.3)'
                        }}>
                          Q{qRange.startQ} to Q{qRange.endQ}
                        </span>
                      )}

                      {isNone && (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                          🚫 Omitted from Exam Paper
                        </span>
                      )}
                      {!isNone && sec.type === 'Long Answer' && (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: sec.choice_mode === 'internal_choice' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.18)',
                          color: sec.choice_mode === 'internal_choice' ? '#34d399' : '#60a5fa',
                          border: sec.choice_mode === 'internal_choice' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                        }}>
                          {sec.choice_mode === 'internal_choice'
                            ? `${numQuestions} Pairs with Internal Choice (${numQuestions * 2} Questions Total)`
                            : `${numQuestions} Direct Compulsory Questions (No Choice)`}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="blueprint-section-subtotal" style={{ color: isNone ? 'var(--text-muted)' : 'var(--accent-cyan)' }}>
                        Subtotal: {subtotal} M
                      </div>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          className="blueprint-icon-btn"
                          onClick={() => handleDeleteSection(sIdx)}
                          title="Delete Section"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: sec.type === 'Long Answer' ? '1.2fr 0.8fr 0.8fr 1.2fr' : '1.5fr 1fr 1fr',
                    gap: '12px',
                    alignItems: 'end'
                  }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Question Type</label>
                      <select
                        className="form-control"
                        value={sec.type}
                        onChange={(e) => handleUpdateSection(sIdx, 'type', e.target.value)}
                      >
                        {QUESTION_TYPES.map(qt => (
                          <option key={qt.value} value={qt.value}>{qt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
                        {sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice' ? 'Choice Pairs' : 'Questions'}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        min={1}
                        max={50}
                        disabled={isNone}
                        value={sec.questions}
                        onChange={(e) => handleUpdateSection(sIdx, 'questions', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Base Marks / Q</label>
                      <input
                        type="number"
                        className="form-control"
                        min={1}
                        max={50}
                        disabled={isNone}
                        value={sec.marks_per_q}
                        onChange={(e) => handleUpdateSection(sIdx, 'marks_per_q', e.target.value)}
                      />
                    </div>

                    {sec.type === 'Long Answer' && (
                      <div>
                        <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px', color: '#38bdf8', fontWeight: 600 }}>
                          ⚙️ Choice Format
                        </label>
                        <select
                          className="form-control"
                          value={sec.choice_mode || 'none'}
                          onChange={(e) => handleUpdateSection(sIdx, 'choice_mode', e.target.value)}
                          style={{
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                            background: 'rgba(15, 23, 42, 0.6)',
                            color: '#f0f9ff',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}
                        >
                          <option value="none">No Choice (Direct Qs)</option>
                          <option value="internal_choice">Internal Choice (Either/Or)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Question Blueprint: Marks, Sub-divisions (8+6, etc.) & CO Mapping */}
                  {!isNone && (
                    <div style={{
                      gridColumn: '1 / -1',
                      marginTop: '14px',
                      padding: '16px 18px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(59, 130, 246, 0.25)'
                    }}>
                      {/* Header & Quick Action Buttons */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                        gap: '10px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.1rem' }}>📋</span>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#93c5fd' }}>
                            Question Allocation & Marks Pattern (Q{qRange.startQ} to Q{qRange.endQ})
                          </span>
                          <span style={{
                            fontSize: '0.74rem',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            border: '1px solid rgba(56, 189, 248, 0.3)'
                          }}>
                            {sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice'
                              ? `${numQuestions} Pairs (${numQuestions * 2} Questions)`
                              : `${numQuestions} Questions`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {sec.type === 'Long Answer' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSetAllSubQuestionsPattern(sIdx, 8, 6)}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '4px 9px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  borderColor: 'rgba(16, 185, 129, 0.5)',
                                  color: '#6ee7b7',
                                  fontWeight: 700
                                }}
                                title="Configure all questions with 8M (a) + 6M (b) pattern (Standard 14M breakdown)"
                              >
                                ⚡ Set 8 + 6 Pattern (All)
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSetAllSubQuestionsPattern(sIdx, 7, 7)}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '4px 9px',
                                  background: 'rgba(59, 130, 246, 0.18)',
                                  borderColor: 'rgba(59, 130, 246, 0.4)',
                                  color: '#93c5fd',
                                  fontWeight: 600
                                }}
                                title="Configure all questions with 7M (a) + 7M (b) pattern"
                              >
                                ⚡ Set 7 + 7 Pattern
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSetAllSingleQuestions(sIdx)}
                                style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                                title="Configure all questions as single questions without sub-division"
                              >
                                ⚡ All Single Qs
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAutoDistributeSectionCOs(sIdx)}
                            style={{
                              fontSize: '0.74rem',
                              padding: '4px 9px',
                              background: 'rgba(14, 165, 233, 0.2)',
                              borderColor: 'rgba(14, 165, 233, 0.45)',
                              color: '#38bdf8',
                              fontWeight: 600
                            }}
                            title="Evenly distribute available Course Outcomes across sub-questions a & b"
                          >
                            ⚡ Auto-Distribute COs
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetSectionCOs(sIdx)}
                            style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                            title="Reset all question target COs to Auto"
                          >
                            🔄 Reset COs
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAutoDistributeSectionBlooms(sIdx)}
                            style={{
                              fontSize: '0.74rem',
                              padding: '4px 9px',
                              background: 'rgba(192, 132, 252, 0.2)',
                              borderColor: 'rgba(192, 132, 252, 0.45)',
                              color: '#c084fc',
                              fontWeight: 600
                            }}
                            title="Evenly distribute Bloom taxonomy levels across questions"
                          >
                            ⚡ Auto-Distribute Blooms
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetSectionBlooms(sIdx)}
                            style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                            title="Reset all question target Bloom levels to Auto"
                          >
                            🔄 Reset Blooms
                          </button>
                        </div>
                      </div>

                      {/* Grid of Questions */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: numQuestions > 2 ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr',
                        gap: '12px'
                      }}>
                        {Array.from({ length: numQuestions }).map((_, qIdx) => {
                          const isInternalChoice = sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice';
                          const q1 = isInternalChoice ? qRange.startQ + qIdx * 2 : qRange.startQ + qIdx;
                          const q2 = isInternalChoice ? q1 + 1 : null;
                          const subDiv = getQuestionSubDivision(sec, qIdx);
                          const qMarks = getQuestionMarks(sec, qIdx);
                          const qCos = getQuestionCOs(sec, qIdx);
                          const qBlooms = getQuestionBlooms(sec, qIdx);

                          // Calculate question slot total marks
                          const totalSlotMarks = subDiv === 'two_subquestions'
                            ? (parseInt(qMarks.q1_a) || 0) + (parseInt(qMarks.q1_b) || 0)
                            : (parseInt(qMarks.q1) || marksPerQ);

                          return (
                            <div
                              key={qIdx}
                              style={{
                                background: 'rgba(30, 41, 59, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              {/* Top Header of Question Card */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                paddingBottom: '8px',
                                flexWrap: 'wrap',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f1f5f9' }}>
                                    {isInternalChoice ? (
                                      <>Pair {qIdx + 1}: <span style={{ color: '#38bdf8' }}>Q{q1} OR Q{q2}</span></>
                                    ) : (
                                      <>Question {qIdx + 1}: <span style={{ color: '#38bdf8' }}>Q{q1}</span></>
                                    )}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {sec.type === 'Long Answer' && (
                                    <select
                                      className="form-control"
                                      value={subDiv}
                                      onChange={(e) => handleUpdateQuestionSubDivision(sIdx, qIdx, e.target.value)}
                                      style={{
                                        fontSize: '0.76rem',
                                        padding: '3px 8px',
                                        height: '28px',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        color: subDiv === 'two_subquestions' ? '#60a5fa' : '#cbd5e1',
                                        borderColor: subDiv === 'two_subquestions' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.15)',
                                        fontWeight: 600
                                      }}
                                    >
                                      <option value="two_subquestions">🧩 2 Sub-questions (a & b)</option>
                                      <option value="none">📄 Single Question</option>
                                    </select>
                                  )}

                                  <span style={{
                                    fontSize: '0.76rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                  }}>
                                    {totalSlotMarks} Marks
                                  </span>
                                </div>
                              </div>

                              {/* Body: Sub-questions with individual Marks, CO & Bloom level */}
                              {subDiv === 'two_subquestions' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {/* Question 1 (e.g. Q11 or Direct Q) */}
                                  <div style={{
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(59, 130, 246, 0.2)'
                                  }}>
                                    {isInternalChoice && (
                                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: '6px' }}>
                                        Question {q1} (First Alternative):
                                      </div>
                                    )}

                                    {/* Sub-question a */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '52px 76px 1fr 1fr',
                                      gap: '6px',
                                      alignItems: 'center',
                                      marginBottom: '6px'
                                    }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>
                                        {isInternalChoice ? `${q1}.a` : `Q${q1}.a`}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <input
                                          type="number"
                                          className="form-control"
                                          min={1}
                                          max={Math.max(1, (parseInt(sec.marks_per_q) || 14) - 1)}
                                          value={qMarks.q1_a}
                                          onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q1_a', e.target.value)}
                                          title={`Sub-question a marks (Restricted: sum must equal ${parseInt(sec.marks_per_q) || 14}M)`}
                                          style={{
                                            fontSize: '0.78rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: '#e2e8f0',
                                            textAlign: 'center',
                                            fontWeight: 700
                                          }}
                                        />
                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                        <select
                                          className="form-control"
                                          value={qCos.q1_a}
                                          onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q1_a', e.target.value)}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: qCos.q1_a !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                            borderColor: qCos.q1_a !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                            fontWeight: 600
                                          }}
                                        >
                                          <option value="auto">Auto</option>
                                          {outcomes.map(oc => (
                                            <option key={oc.id} value={oc.id}>{oc.id}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                        <select
                                          className="form-control"
                                          value={qBlooms.q1_a}
                                          onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q1_a', e.target.value)}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: qBlooms.q1_a !== 'auto' ? '#c084fc' : '#e2e8f0',
                                            borderColor: qBlooms.q1_a !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                            fontWeight: 600
                                          }}
                                        >
                                          <option value="auto">Auto</option>
                                          {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                            <option key={bl} value={bl}>{bl}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {/* Sub-question b */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '52px 76px 1fr 1fr',
                                      gap: '6px',
                                      alignItems: 'center'
                                    }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>
                                        {isInternalChoice ? `${q1}.b` : `Q${q1}.b`}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <input
                                          type="number"
                                          className="form-control"
                                          min={1}
                                          max={Math.max(1, (parseInt(sec.marks_per_q) || 14) - 1)}
                                          value={qMarks.q1_b}
                                          onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q1_b', e.target.value)}
                                          title={`Sub-question b marks (Restricted: sum must equal ${parseInt(sec.marks_per_q) || 14}M)`}
                                          style={{
                                            fontSize: '0.78rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: '#e2e8f0',
                                            textAlign: 'center',
                                            fontWeight: 700
                                          }}
                                        />
                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                        <select
                                          className="form-control"
                                          value={qCos.q1_b}
                                          onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q1_b', e.target.value)}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: qCos.q1_b !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                            borderColor: qCos.q1_b !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                            fontWeight: 600
                                          }}
                                        >
                                          <option value="auto">Auto</option>
                                          {outcomes.map(oc => (
                                            <option key={oc.id} value={oc.id}>{oc.id}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                        <select
                                          className="form-control"
                                          value={qBlooms.q1_b}
                                          onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q1_b', e.target.value)}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '3px 4px',
                                            height: '28px',
                                            background: 'rgba(30, 41, 59, 0.9)',
                                            color: qBlooms.q1_b !== 'auto' ? '#c084fc' : '#e2e8f0',
                                            borderColor: qBlooms.q1_b !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                            fontWeight: 600
                                          }}
                                        >
                                          <option value="auto">Auto</option>
                                          {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                            <option key={bl} value={bl}>{bl}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Question 2 if internal choice (e.g. Q12 OR) */}
                                  {isInternalChoice && (
                                    <>
                                      <div style={{
                                        textAlign: 'center',
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        color: '#94a3b8',
                                        letterSpacing: '1px',
                                        margin: '2px 0'
                                      }}>
                                        ─── [ OR ] ───
                                      </div>

                                      <div style={{
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                      }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: '6px' }}>
                                          Question {q2} (Second Alternative):
                                        </div>

                                        {/* Sub-question a */}
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '52px 76px 1fr 1fr',
                                          gap: '6px',
                                          alignItems: 'center',
                                          marginBottom: '6px'
                                        }}>
                                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>
                                            {q2}.a
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <input
                                              type="number"
                                              className="form-control"
                                              min={1}
                                              max={Math.max(1, (parseInt(sec.marks_per_q) || 14) - 1)}
                                              value={qMarks.q2_a}
                                              onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q2_a', e.target.value)}
                                              title={`Sub-question a marks (Restricted: sum must equal ${parseInt(sec.marks_per_q) || 14}M)`}
                                              style={{
                                                fontSize: '0.78rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: '#e2e8f0',
                                                textAlign: 'center',
                                                fontWeight: 700
                                              }}
                                            />
                                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                            <select
                                              className="form-control"
                                              value={qCos.q2_a}
                                              onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q2_a', e.target.value)}
                                              style={{
                                                fontSize: '0.74rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: qCos.q2_a !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                                borderColor: qCos.q2_a !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                                fontWeight: 600
                                              }}
                                            >
                                              <option value="auto">Auto</option>
                                              {outcomes.map(oc => (
                                                <option key={oc.id} value={oc.id}>{oc.id}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                            <select
                                              className="form-control"
                                              value={qBlooms.q2_a}
                                              onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q2_a', e.target.value)}
                                              style={{
                                                fontSize: '0.74rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: qBlooms.q2_a !== 'auto' ? '#c084fc' : '#e2e8f0',
                                                borderColor: qBlooms.q2_a !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                                fontWeight: 600
                                              }}
                                            >
                                              <option value="auto">Auto</option>
                                              {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                                <option key={bl} value={bl}>{bl}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        {/* Sub-question b */}
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '52px 76px 1fr 1fr',
                                          gap: '6px',
                                          alignItems: 'center'
                                        }}>
                                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>
                                            {q2}.b
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <input
                                              type="number"
                                              className="form-control"
                                              min={1}
                                              max={Math.max(1, (parseInt(sec.marks_per_q) || 14) - 1)}
                                              value={qMarks.q2_b}
                                              onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q2_b', e.target.value)}
                                              title={`Sub-question b marks (Restricted: sum must equal ${parseInt(sec.marks_per_q) || 14}M)`}
                                              style={{
                                                fontSize: '0.78rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: '#e2e8f0',
                                                textAlign: 'center',
                                                fontWeight: 700
                                              }}
                                            />
                                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                            <select
                                              className="form-control"
                                              value={qCos.q2_b}
                                              onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q2_b', e.target.value)}
                                              style={{
                                                fontSize: '0.74rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: qCos.q2_b !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                                borderColor: qCos.q2_b !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                                fontWeight: 600
                                              }}
                                            >
                                              <option value="auto">Auto</option>
                                              {outcomes.map(oc => (
                                                <option key={oc.id} value={oc.id}>{oc.id}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                            <select
                                              className="form-control"
                                              value={qBlooms.q2_b}
                                              onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q2_b', e.target.value)}
                                              style={{
                                                fontSize: '0.74rem',
                                                padding: '3px 4px',
                                                height: '28px',
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                color: qBlooms.q2_b !== 'auto' ? '#c084fc' : '#e2e8f0',
                                                borderColor: qBlooms.q2_b !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                                fontWeight: 600
                                              }}
                                            >
                                              <option value="auto">Auto</option>
                                              {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                                <option key={bl} value={bl}>{bl}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                /* Single Question Mode */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '52px 76px 1fr 1fr',
                                    gap: '6px',
                                    alignItems: 'center'
                                  }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#f8fafc' }}>
                                      Q{q1}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <input
                                        type="number"
                                        className="form-control"
                                        min={1}
                                        max={50}
                                        value={qMarks.q1}
                                        onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q1', e.target.value)}
                                        style={{
                                          fontSize: '0.78rem',
                                          padding: '3px 4px',
                                          height: '28px',
                                          background: 'rgba(30, 41, 59, 0.9)',
                                          color: '#e2e8f0',
                                          textAlign: 'center',
                                          fontWeight: 700
                                        }}
                                      />
                                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                      <select
                                        className="form-control"
                                        value={qCos.q1}
                                        onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q1', e.target.value)}
                                        style={{
                                          fontSize: '0.74rem',
                                          padding: '3px 4px',
                                          height: '28px',
                                          background: 'rgba(30, 41, 59, 0.9)',
                                          color: qCos.q1 !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                          borderColor: qCos.q1 !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                          fontWeight: 600
                                        }}
                                      >
                                        <option value="auto">Auto</option>
                                        {outcomes.map(oc => (
                                          <option key={oc.id} value={oc.id}>{oc.id}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                      <select
                                        className="form-control"
                                        value={qBlooms.q1}
                                        onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q1', e.target.value)}
                                        style={{
                                          fontSize: '0.74rem',
                                          padding: '3px 4px',
                                          height: '28px',
                                          background: 'rgba(30, 41, 59, 0.9)',
                                          color: qBlooms.q1 !== 'auto' ? '#c084fc' : '#e2e8f0',
                                          borderColor: qBlooms.q1 !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                          fontWeight: 600
                                        }}
                                      >
                                        <option value="auto">Auto</option>
                                        {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                          <option key={bl} value={bl}>{bl}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {isInternalChoice && (
                                    <>
                                      <div style={{
                                        textAlign: 'center',
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        color: '#94a3b8',
                                        letterSpacing: '1px',
                                        margin: '2px 0'
                                      }}>
                                        ─── [ OR ] ───
                                      </div>

                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '52px 76px 1fr 1fr',
                                        gap: '6px',
                                        alignItems: 'center'
                                      }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#f8fafc' }}>
                                          Q{q2}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                          <input
                                            type="number"
                                            className="form-control"
                                            min={1}
                                            max={50}
                                            value={qMarks.q2}
                                            onChange={(e) => handleUpdateQuestionMark(sIdx, qIdx, 'q2', e.target.value)}
                                            style={{
                                              fontSize: '0.78rem',
                                              padding: '3px 4px',
                                              height: '28px',
                                              background: 'rgba(30, 41, 59, 0.9)',
                                              color: '#e2e8f0',
                                              textAlign: 'center',
                                              fontWeight: 700
                                            }}
                                          />
                                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>M</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                          <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>CO:</span>
                                          <select
                                            className="form-control"
                                            value={qCos.q2}
                                            onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q2', e.target.value)}
                                            style={{
                                              fontSize: '0.74rem',
                                              padding: '3px 4px',
                                              height: '28px',
                                              background: 'rgba(30, 41, 59, 0.9)',
                                              color: qCos.q2 !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                              borderColor: qCos.q2 !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
                                              fontWeight: 600
                                            }}
                                          >
                                            <option value="auto">Auto</option>
                                            {outcomes.map(oc => (
                                              <option key={oc.id} value={oc.id}>{oc.id}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                          <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>BL:</span>
                                          <select
                                            className="form-control"
                                            value={qBlooms.q2}
                                            onChange={(e) => handleUpdateQuestionBloom(sIdx, qIdx, 'q2', e.target.value)}
                                            style={{
                                              fontSize: '0.74rem',
                                              padding: '3px 4px',
                                              height: '28px',
                                              background: 'rgba(30, 41, 59, 0.9)',
                                              color: qBlooms.q2 !== 'auto' ? '#c084fc' : '#e2e8f0',
                                              borderColor: qBlooms.q2 !== 'auto' ? '#9333ea' : 'rgba(255, 255, 255, 0.15)',
                                              fontWeight: 600
                                            }}
                                          >
                                            <option value="auto">Auto</option>
                                            {(blooms && blooms.length > 0 ? blooms : BLOOM_LEVELS).map(bl => (
                                              <option key={bl} value={bl}>{bl}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddSection}
                style={{ fontSize: '0.9rem' }}
              >
                + Add Another Section
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: COURSE OUTCOMES (COs) */}
        {activeTab === 'outcomes' && (
          <div>
            {/* Header & Quick Action Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
                  <span>🎯</span>
                  <span>Course Outcomes (COs) Configuration</span>
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Define or automatically extract Course Outcomes. Questions are synthesized strictly aligned with these COs and their mapped units.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExtractCOsFromDocuments}
                  disabled={extractingCOs}
                  style={{ fontSize: '0.82rem', padding: '6px 14px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                  title="Extracts explicit Course Outcomes directly from the uploaded document, or synthesizes from syllabus units if not explicitly present"
                >
                  {extractingCOs ? '⚡ Processing Syllabus...' : '🪄 Auto-Extract from Document'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoGenerateCOsFromCourse}
                  disabled={extractingCOs}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  title="Intelligently synthesizes 6 OBE Course Outcomes grounded directly in the syllabus units and topics"
                >
                  ✨ Auto-Generate from Course Topics
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetOutcomes}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  title="Reset to default standard OBE Outcome template"
                >
                  🔄 Reset Template
                </button>
              </div>
            </div>

            {/* CO Status Banners */}
            {coDetectionStatus === 'not_found' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fbbf24',
                padding: '14px 18px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>
                  <strong>No Course Outcomes (COs) detected in the uploaded documents.</strong>
                  <div style={{ fontSize: '0.82rem', color: '#fef3c7', marginTop: '2px' }}>
                    You can add your Course Outcomes manually using the form below, or click <strong>"✨ Auto-Generate from Course Topics"</strong> to generate syllabus-grounded COs automatically.
                  </div>
                </div>
              </div>
            )}

            {coDetectionStatus === 'found' && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                padding: '12px 18px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>✓</span>
                  <span>Course Outcomes configured and mapped to syllabus units!</span>
                </div>
                {coSourceInfo && (
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.25)',
                    padding: '3px 9px',
                    borderRadius: '4px',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)'
                  }}>
                    Source: {coSourceInfo}
                  </span>
                )}
              </div>
            )}

            {/* Add New Course Outcome Form */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--border-radius)',
              padding: '18px 20px',
              marginBottom: '24px'
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>➕</span> <span>Add Custom Course Outcome</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 140px auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>CO ID</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newCoId}
                    onChange={(e) => setNewCoId(e.target.value)}
                    placeholder="e.g. CO1"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Outcome Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newCoDesc}
                    onChange={(e) => setNewCoDesc(e.target.value)}
                    placeholder="e.g. Apply exception handling and multithreading synchronization in concurrent applications..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddOutcome(); }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Bloom's Level</label>
                  <select
                    className="form-control"
                    value={newCoBloom}
                    onChange={(e) => setNewCoBloom(e.target.value)}
                  >
                    {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].map(bl => (
                      <option key={bl} value={bl}>{bl}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Mapped Unit</label>
                  <select
                    className="form-control"
                    value={newCoUnit}
                    onChange={(e) => setNewCoUnit(e.target.value)}
                  >
                    {availableUnits.map(u => (
                      <option key={u.unit_key} value={u.unit_key}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddOutcome}
                  disabled={!newCoDesc.trim()}
                  style={{ fontSize: '0.85rem', padding: '9px 18px' }}
                >
                  + Add CO
                </button>
              </div>
            </div>

            {/* List of Configured Course Outcomes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {outcomes.map((coItem, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 140px 120px 40px',
                    gap: '14px',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.15)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    {coItem.id}
                  </div>

                  <div>
                    <input
                      type="text"
                      className="form-control"
                      value={coItem.description}
                      onChange={(e) => handleUpdateOutcomeText(index, 'description', e.target.value)}
                      style={{ fontSize: '0.88rem', background: 'transparent', border: '1px solid transparent' }}
                      onFocus={(e) => e.target.style.border = '1px solid rgba(59, 130, 246, 0.4)'}
                      onBlur={(e) => e.target.style.border = '1px solid transparent'}
                    />
                  </div>

                  <div>
                    <select
                      className="form-control"
                      value={coItem.bloom_level || 'Understand'}
                      onChange={(e) => handleUpdateOutcomeText(index, 'bloom_level', e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                    >
                      {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].map(bl => (
                        <option key={bl} value={bl}>{bl}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      className="form-control"
                      value={coItem.unit || (availableUnits[0] ? availableUnits[0].unit_key : 'Unit 1')}
                      onChange={(e) => handleUpdateOutcomeText(index, 'unit', e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                    >
                      {availableUnits.map(u => (
                        <option key={u.unit_key} value={u.unit_key}>{u.unit_label ? `${u.unit_label} (${u.unit_key})` : u.unit_key}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="blueprint-icon-btn"
                    onClick={() => handleDeleteOutcome(index)}
                    title="Delete Course Outcome"
                    style={{ justifySelf: 'center' }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TOPICS & UNITS */}
        {activeTab === 'topics' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📖</span> <span>Syllabus Units & Topics Allocation</span>
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Units, titles, and syllabus topics extracted directly from uploaded curriculum documents. Question items are grounded strictly in these concepts.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExtractUnitsFromDocuments}
                  disabled={extractingUnits}
                  style={{
                    fontSize: '0.82rem',
                    padding: '7px 15px',
                    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
                    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
                    fontWeight: 700
                  }}
                  title="Extract units (Unit-I, Unit-II...), titles, hours, and technical topics directly from syllabus document headings"
                >
                  {extractingUnits ? '⏳ Extracting Units...' : '⚡ Auto-Detect Units from Document'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePreloadDefaultTopics}
                  style={{ fontSize: '0.82rem', padding: '7px 13px' }}
                  title="Preload standardized 4-unit curriculum"
                >
                  ↺ Preload Standard Units
                </button>
              </div>
            </div>

            {/* Total Weight Progress Bar & Unit Stats */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '22px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>Total Curriculum Weight:</span>
                  <strong style={{ fontSize: '0.95rem', color: totalTopicWeight === 100 ? '#10b981' : '#f59e0b' }}>
                    {totalTopicWeight}% {totalTopicWeight === 100 ? '✓ Balanced (100%)' : `⚠️ Adjust to 100% (currently ${totalTopicWeight}%)`}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}>
                    🏛️ {topics.length} Units Configured
                  </span>
                  <span style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600 }}>
                    🏷️ {topics.reduce((acc, u) => acc + (u.topics?.length || 0), 0)} Topics Grounded
                  </span>
                </div>
              </div>
              <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, totalTopicWeight)}%`, height: '100%', background: totalTopicWeight === 100 ? '#10b981' : '#f59e0b', transition: 'all 0.3s ease' }} />
              </div>
            </div>

            {/* Units Cards Grid / List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px' }}>
              {topics.map((u, idx) => (
                <div
                  key={u.id || idx}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Unit Top Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
                      <span style={{
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(59, 130, 246, 0.25))',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap'
                      }}>
                        {u.unit_label || u.unit_key || `Unit ${idx + 1}`}
                      </span>

                      {u.hours && (
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}>
                          ⏱️ {u.hours}
                        </span>
                      )}

                      <input
                        type="text"
                        className="form-control"
                        value={u.unit_title || u.name || ''}
                        onChange={(e) => handleUpdateUnitTitle(idx, e.target.value)}
                        placeholder="Unit Title (e.g. Overview of Web databases)"
                        style={{
                          fontWeight: 700,
                          fontSize: '0.96rem',
                          color: '#f8fafc',
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderColor: 'rgba(255, 255, 255, 0.12)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          flex: 1
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weight:</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="form-control"
                          value={u.weight || 25}
                          onChange={(e) => handleUpdateTopicWeight(idx, e.target.value)}
                          style={{ width: '65px', fontSize: '0.88rem', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                      <button
                        type="button"
                        className="blueprint-icon-btn"
                        onClick={() => handleDeleteTopic(idx)}
                        title="Delete this unit"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Unit Topics Cloud */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60a5fa', marginBottom: '8px' }}>
                      Extracted Technical Topics ({(u.topics || []).length}):
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {(u.topics && u.topics.length > 0) ? (
                        u.topics.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(30, 41, 59, 0.85)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              padding: '5px 12px',
                              borderRadius: '16px',
                              fontSize: '0.82rem',
                              color: '#cbd5e1',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                          >
                            <span>{c}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteConceptFromUnit(idx, cIdx)}
                              title="Remove topic"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '0 2px',
                                fontSize: '0.9rem',
                                lineHeight: 1
                              }}
                              onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No specific topics parsed for this unit yet. Add topics below or click Auto-Detect.
                        </span>
                      )}
                    </div>

                    {/* Add Topic Inline Form */}
                    <div style={{ display: 'flex', gap: '8px', maxWidth: '440px' }}>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                        value={unitConceptInputs[idx] || ''}
                        onChange={(e) => setUnitConceptInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="+ Add technical topic under this unit..."
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddConceptToUnit(idx); }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => handleAddConceptToUnit(idx)}
                      >
                        + Add Topic
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Unit Row */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.35)',
              border: '1px dashed rgba(59, 130, 246, 0.35)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: '130px 1fr 140px 100px auto',
              gap: '12px',
              alignItems: 'end'
            }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Unit Label</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Unit-${['I','II','III','IV','V','VI'][topics.length] || (topics.length + 1)}`}
                  id="new-unit-label"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Unit Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Advanced Security & Microservices Architecture"
                  id="new-unit-title"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Hours</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 12 Hours"
                  id="new-unit-hours"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Weight (%)</label>
                <input
                  type="number"
                  className="form-control"
                  defaultValue={20}
                  min={1}
                  max={100}
                  id="new-unit-weight"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '9px 18px' }}
                onClick={() => {
                  const lbl = document.getElementById('new-unit-label')?.value || '';
                  const ttl = document.getElementById('new-unit-title')?.value || '';
                  const hrs = document.getElementById('new-unit-hours')?.value || '';
                  const wt = document.getElementById('new-unit-weight')?.value || '20';
                  if (!ttl.trim()) {
                    showNotification('Please enter a unit title', 'error');
                    return;
                  }
                  handleAddCustomUnit(lbl.trim(), ttl.trim(), hrs.trim(), wt);
                  if (document.getElementById('new-unit-title')) document.getElementById('new-unit-title').value = '';
                }}
              >
                + Add Unit
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: DIFFICULTY & BLOOMS */}
        {activeTab === 'difficulty' && (
          <div>
            <div className="blueprint-diff-row">
              <div className="blueprint-diff-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                  <span>🟢</span> <strong>Easy</strong>
                </span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{difficulty.easy}%</span>
              </div>
              <input
                type="range"
                className="blueprint-range-slider"
                min={0}
                max={100}
                step={5}
                value={difficulty.easy}
                onChange={(e) => handleDifficultyChange('easy', e.target.value)}
              />
            </div>

            <div className="blueprint-diff-row">
              <div className="blueprint-diff-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                  <span>🟡</span> <strong>Medium</strong>
                </span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>{difficulty.medium}%</span>
              </div>
              <input
                type="range"
                className="blueprint-range-slider"
                min={0}
                max={100}
                step={5}
                value={difficulty.medium}
                onChange={(e) => handleDifficultyChange('medium', e.target.value)}
              />
            </div>

            <div className="blueprint-diff-row">
              <div className="blueprint-diff-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                  <span>🔴</span> <strong>Hard</strong>
                </span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>{difficulty.hard}%</span>
              </div>
              <input
                type="range"
                className="blueprint-range-slider"
                min={0}
                max={100}
                step={5}
                value={difficulty.hard}
                onChange={(e) => handleDifficultyChange('hard', e.target.value)}
              />
            </div>

            <div className="blueprint-stacked-bar">
              <div style={{ width: `${difficulty.easy}%`, background: '#10b981' }} title={`Easy ${difficulty.easy}%`} />
              <div style={{ width: `${difficulty.medium}%`, background: '#f59e0b' }} title={`Medium ${difficulty.medium}%`} />
              <div style={{ width: `${difficulty.hard}%`, background: '#ef4444' }} title={`Hard ${difficulty.hard}%`} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Easy ({difficulty.easy}%)</span>
              <span>Medium ({difficulty.medium}%)</span>
              <span>Hard ({difficulty.hard}%)</span>
            </div>

            {/* Bloom's Cognitive Levels Selector */}
            <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <label className="form-label" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🧠</span>
                    <span>Bloom's Taxonomy Cognitive Levels</span>
                  </label>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    Click any level to toggle inclusion in the question synthesis pool.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Custom Bloom Level..."
                    value={customBloomInput}
                    onChange={(e) => setCustomBloomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomBloom(); } }}
                    style={{ padding: '6px 12px', fontSize: '0.84rem', width: '170px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleAddCustomBloom()}
                    disabled={!customBloomInput.trim()}
                    style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                  >
                    + Add
                  </button>

                  <select
                    className="form-control"
                    value={bloomDropdownSelect}
                    onChange={handleBloomDropdownChange}
                    style={{ padding: '6px 12px', fontSize: '0.84rem', width: '160px' }}
                  >
                    <option value="">Preset Levels...</option>
                    {BLOOM_LEVELS.map(bl => (
                      <option key={bl.value} value={bl.value}>{bl.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bloom-pills-container">
                {blooms.map(bloom => {
                  const isActive = selectedBlooms.includes(bloom);
                  return (
                    <button
                      key={bloom}
                      type="button"
                      className={`bloom-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => toggleBloom(bloom)}
                    >
                      <span>{isActive ? '✓' : '+'}</span>
                      <span>{bloom}</span>
                      <span
                        className="bloom-pill-remove"
                        title="Remove from blueprint"
                        onClick={(e) => handleRemoveBloom(bloom, e)}
                      >
                        ✕
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          className="blueprint-generate-btn"
          disabled={generating || !selectedCourse}
          onClick={handleGenerate}
        >
          {generating ? '✨ Synthesizing Questions with AI...' : '✨ Generate Question Paper'}
        </button>
      </div>

      {/* DOCUMENT INSPECTION MODAL */}
      <Modal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `Extracted Faculty Material: ${previewDoc.title}` : 'Document Preview'}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Course: <strong>{previewDoc?.course_name || 'Course Document'}</strong> • Uploader: <strong>{previewDoc?.user_name || 'Faculty Member'}</strong>
            </div>
            {previewDoc && (
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '4px',
                background: previewDoc.file_type === 'pdf' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                color: previewDoc.file_type === 'pdf' ? '#f87171' : '#60a5fa',
                border: previewDoc.file_type === 'pdf' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)'
              }}>
                {previewDoc.file_type} Document
              </span>
            )}
          </div>

          {loadingPreview ? (
            <div style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Loader message="Fetching extracted document text..." />
            </div>
          ) : (
            <>
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '16px',
                borderRadius: 'var(--border-radius)',
                maxHeight: '380px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.86rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary)'
              }}>
                {previewDoc?.extracted_text || previewDoc?.extracted_text_preview || 'No text extracted from this file.'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>
                  {previewDoc?.extracted_text ? `✓ Indexed: ${previewDoc.extracted_text.length.toLocaleString()} characters (${previewDoc.extracted_text.split(/\s+/).filter(Boolean).length.toLocaleString()} words)` : previewDoc?.text_length ? `✓ Indexed: ${previewDoc.text_length.toLocaleString()} characters` : ''}
                </span>
                {previewDoc?.id && (
                  <button
                    type="button"
                    onClick={(e) => handleDownloadDoc(previewDoc, e)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    title="Download this original file directly to your computer"
                  >
                    📥 Download Original File
                  </button>
                )}
              </div>
            </>
          )}

          <div className="modal-footer" style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {previewDoc && (
              <button
                type="button"
                className={`btn ${selectedDocIds.includes(previewDoc.id) ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  toggleDocSelection(previewDoc.id);
                  if (previewDoc.course_id && String(previewDoc.course_id) !== String(selectedCourse)) {
                    setSelectedCourse(String(previewDoc.course_id));
                  }
                }}
                style={{ fontSize: '0.86rem' }}
              >
                {selectedDocIds.includes(previewDoc.id) ? '✕ Remove from AI Generation' : '✓ Select for AI Generation'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* GENERATED QUESTION PAPER PREVIEW & ACTIONS */}
      {generatedPaper && (
        <div id="generated-paper-preview" style={{ marginTop: '36px' }}>
          {/* Action Toolbar */}
          <div className="no-print" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '16px 22px',
            borderRadius: 'var(--border-radius)',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#93c5fd' }}>
                ✨ Generated Examination Paper Preview
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Questions are synthesized strictly aligned with your Course Outcomes (COs) and Syllabus. Edit any question text directly below before archiving.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrint}
              >
                🖨️ Print / Save PDF
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveToArchive}
                disabled={saving}
              >
                {saving ? 'Saving...' : savedPaper ? '✓ Saved to Archive' : '💾 Save to Department Archive'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderColor: '#10b981',
                  fontWeight: 600
                }}
                onClick={handleOpenProtectModal}
                disabled={saving}
              >
                🔒 Protect PDF with Password
              </button>
            </div>
          </div>

          {/* Formatted Question Paper Sheet */}
          <div id="printable-question-paper" className="academic-qp-sheet" style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
            marginBottom: '24px'
          }}>
            <AcademicQuestionPaper
              paper={generatedPaper}
              editable={true}
              onQuestionChange={handleAcademicQuestionChange}
            />
          </div>

            {/* Course Outcomes Alignment & Coverage Matrix */}
            {generatedPaper.co_matrix && generatedPaper.co_matrix.length > 0 && (
              <div className="no-print" style={{
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '2px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯</span> <span>Course Outcomes (CO) Alignment & Coverage Matrix</span>
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 700 }}>CO ID</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700 }}>Outcome Statement / Description</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700 }}>Target Bloom</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700 }}>Mapped Unit</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700 }}>Questions Mapped</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Total Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedPaper.co_matrix.map((com, cIdx) => (
                        <tr key={cIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0284c7' }}>{com.id}</td>
                          <td style={{ padding: '8px 12px', color: '#1e293b' }}>{com.description}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{com.bloom_level}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{com.unit}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                            {com.question_numbers && com.question_numbers.length > 0 ? com.question_numbers.join(', ') : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                            {com.marks} M ({generatedPaper.total_marks > 0 ? Math.round((com.marks / generatedPaper.total_marks) * 100) : 0}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Protect Paper with Password Modal */}
      {showProtectModal && (savedPaper || generatedPaper) && (
        <ProtectQPModal
          isOpen={showProtectModal}
          onClose={() => setShowProtectModal(false)}
          paper={savedPaper || {
            ...generatedPaper,
            id: savedPaper?.id,
            title: generatedPaper?.title || title,
            course_name: generatedPaper?.course_name,
            course_code: generatedPaper?.course_code,
            total_marks: generatedPaper?.total_marks || totalCalculatedMarks
          }}
          paperId={savedPaper?.id}
          paperTitle={savedPaper?.title || generatedPaper?.title || title}
          onSuccess={() => {
            showNotification('Question paper successfully protected. Password shared with the selected faculty members.');
          }}
        />
      )}
    </div>
  );
};

export default QPGenerator;
