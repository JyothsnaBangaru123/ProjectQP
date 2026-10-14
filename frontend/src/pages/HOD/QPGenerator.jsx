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
import { YEARS, SEMESTERS, EXAM_TITLES, BLOOM_LEVELS, getAcademicYear } from '../../utils/constants';

const QUESTION_TYPES = [
  { value: 'MCQ', label: "MCQ's" },
  { value: 'Short Answer', label: 'Short Answers' },
  { value: 'Long Answer', label: 'Long Answers' },
  { value: 'None', label: 'None' }
];

const DEFAULT_COS = [
  { id: 'CO1', description: 'Analyze computational complexity and foundational architectures of the course domain', bloom_level: 'Understand', unit: 'Unit 1' },
  { id: 'CO2', description: 'Demonstrate algorithmic strategies, state management, and design paradigms', bloom_level: 'Apply', unit: 'Unit 2' },
  { id: 'CO3', description: 'Design modular solutions, interfaces, and component interaction models', bloom_level: 'Apply', unit: 'Unit 3' },
  { id: 'CO4', description: 'Formulate error handling, fault tolerance, and concurrency synchronization mechanisms', bloom_level: 'Analyze', unit: 'Unit 4' },
  { id: 'CO5', description: 'Evaluate architectural trade-offs, memory footprints, and system performance metrics', bloom_level: 'Evaluate', unit: 'Unit 5' }
];

const QPGenerator = () => {
  const { user, branchName } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'details' | 'structure' | 'outcomes' | 'topics' | 'difficulty'
  const [activeTab, setActiveTab] = useState('details');

  const [courses, setCourses] = useState([]);
  const [blooms, setBlooms] = useState([]);
  const [qlevels, setQlevels] = useState([]);
  const [courseDocuments, setCourseDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [docScope, setDocScope] = useState('course'); // 'course' | 'all'
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDirectToDb, setUploadingDirectToDb] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [extractingCOs, setExtractingCOs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Details State
  const [institutionName, setInstitutionName] = useState('Grand National Tech University');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [title, setTitle] = useState(EXAM_TITLES[0].value);
  const [duration, setDuration] = useState('3 Hours');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  });
  const [academicYear, setAcademicYear] = useState(() => getAcademicYear());
  const [sem, setSem] = useState(1);
  const [totalMarks, setTotalMarks] = useState(70);
  const [specialInstructions, setSpecialInstructions] = useState(
    '1. All questions are compulsory.\n2. Simple scientific calculators are permitted.\n3. Assume suitable data if necessary.'
  );

  // Material & Course Documents State
  const [materialText, setMaterialText] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 2. Structure State (Sections)
  const [sections, setSections] = useState([
    { id: 1, name: 'Section A', type: 'MCQ', questions: 10, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(10).fill('auto') },
    { id: 2, name: 'Section B', type: 'Short Answer', questions: 5, marks_per_q: 4, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto') },
    { id: 3, name: 'Section C', type: 'Long Answer', questions: 3, marks_per_q: 10, choice_mode: 'none', sub_division: 'mixed', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'], question_cos: Array(3).fill('auto') }
  ]);

  // 3. Course Outcomes (COs) State
  const [outcomes, setOutcomes] = useState(DEFAULT_COS);
  const [coDetectionStatus, setCoDetectionStatus] = useState('idle'); // 'idle' | 'found' | 'not_found'
  const [newCoId, setNewCoId] = useState('CO6');
  const [newCoDesc, setNewCoDesc] = useState('');
  const [newCoBloom, setNewCoBloom] = useState('Understand');
  const [newCoUnit, setNewCoUnit] = useState('Unit 1');

  // 4. Topics State
  const [topics, setTopics] = useState([
    { id: 1, name: 'Core Foundations & Architectural Principles', weight: 25 },
    { id: 2, name: 'Algorithms, Data Flows & Methodologies', weight: 25 },
    { id: 3, name: 'Component Implementation & Modular Design', weight: 25 },
    { id: 4, name: 'System Optimization, Error Recovery & Performance', weight: 25 }
  ]);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicWeight, setNewTopicWeight] = useState(25);

  // 5. Difficulty & Blooms State
  const [difficulty, setDifficulty] = useState({ easy: 40, medium: 40, hard: 20 });
  const [selectedBlooms, setSelectedBlooms] = useState(['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']);
  const [bloomDropdownSelect, setBloomDropdownSelect] = useState('');
  const [customBloomInput, setCustomBloomInput] = useState('');

  // Generated Paper Result
  const [generatedPaper, setGeneratedPaper] = useState(null);

  // Automatically calculate total marks from sections
  const totalCalculatedMarks = useMemo(() => {
    return sections
      .filter(sec => sec.type !== 'None')
      .reduce((sum, sec) => sum + (parseInt(sec.questions || 0) * parseInt(sec.marks_per_q || 0)), 0);
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
        const dbTaxonomies = bloomsRes.data.filter(b => b.status === 1).map(b => b.taxonomy);
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
        { id: 1, name: 'Section A', type: 'MCQ', questions: 10, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(10).fill('auto') },
        { id: 2, name: 'Section B', type: 'Short Answer', questions: 5, marks_per_q: 4, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto') },
        { id: 3, name: 'Section C', type: 'Long Answer', questions: 3, marks_per_q: 10, choice_mode: 'none', sub_division: 'mixed', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'], question_cos: Array(3).fill('auto') }
      ]);
      showNotification('Examination title set to End Semester Examination. Sections auto-configured.');
    } else if (titleLower.includes('mid')) {
      setTotalMarks(40);
      setDuration('2 Hours');
      setSections([
        { id: 1, name: 'Section A', type: 'Short Answer', questions: 5, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto') },
        { id: 2, name: 'Section B', type: 'Long Answer', questions: 3, marks_per_q: 10, choice_mode: 'none', sub_division: 'mixed', question_sub_divisions: ['two_subquestions', 'two_subquestions', 'none'], question_cos: Array(3).fill('auto') }
      ]);
      showNotification(`Examination title set to ${newTitle}. Sections auto-configured.`);
    } else if (titleLower.includes('continuous') || titleLower.includes('obe')) {
      setTotalMarks(30);
      setDuration('1.5 Hours');
      setSections([
        { id: 1, name: 'Section A', type: 'Short Answer', questions: 5, marks_per_q: 2, choice_mode: 'none', sub_division: 'none', question_cos: Array(5).fill('auto') },
        { id: 2, name: 'Section B', type: 'Long Answer', questions: 2, marks_per_q: 10, choice_mode: 'none', sub_division: 'two_subquestions', question_sub_divisions: ['two_subquestions', 'two_subquestions'], question_cos: Array(2).fill('auto') }
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
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    const currentList = docScope === 'course' ? courseDocuments : allDocuments;
    const allIds = currentList.map(d => d.id);
    setSelectedDocIds(prev => Array.from(new Set([...prev, ...allIds])));
    showNotification(`Selected all ${currentList.length} documents for AI question generation`);
  };

  const handleClearDocSelections = () => {
    const currentList = docScope === 'course' ? courseDocuments : allDocuments;
    const currentIds = new Set(currentList.map(d => d.id));
    setSelectedDocIds(prev => prev.filter(id => !currentIds.has(id)));
    showNotification('Cleared document selections');
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
      question_cos: ['auto', 'auto', 'auto']
    };
    setSections([...sections, newSec]);
  };

  const handleUpdateSection = (index, field, value) => {
    const updated = [...sections];
    if (field === 'type' && value === 'Long Answer') {
      if (!updated[index].choice_mode) updated[index].choice_mode = 'none';
      if (!updated[index].sub_division) updated[index].sub_division = 'two_subquestions';
    }
    updated[index][field] = (field === 'questions' || field === 'marks_per_q') ? Math.max(1, parseInt(value) || 1) : value;

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
    }

    setSections(updated);
  };

  const handleUpdateQuestionCO = (sectionIdx, qIdx, subKeyOrValue, valIfSubKey) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const isInternalChoice = sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice';
    const currentList = Array.isArray(sec.question_cos) ? [...sec.question_cos] : [];
    
    while (currentList.length < numQ) {
      currentList.push(isInternalChoice ? { q1: 'auto', q2: 'auto' } : 'auto');
    }

    if (isInternalChoice && (subKeyOrValue === 'q1' || subKeyOrValue === 'q2')) {
      const existing = typeof currentList[qIdx] === 'object' && currentList[qIdx] !== null
        ? { ...currentList[qIdx] }
        : { q1: currentList[qIdx] || 'auto', q2: currentList[qIdx] || 'auto' };
      existing[subKeyOrValue] = valIfSubKey;
      currentList[qIdx] = existing;
    } else {
      currentList[qIdx] = subKeyOrValue;
    }

    sec.question_cos = currentList;
    setSections(updated);
  };

  const handleAutoDistributeSectionCOs = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const isInternalChoice = sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice';
    const coList = outcomes && outcomes.length > 0 ? outcomes.map(o => o.id) : ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
    const distributed = [];
    
    for (let i = 0; i < numQ; i++) {
      if (isInternalChoice) {
        distributed.push({
          q1: coList[(i * 2) % coList.length],
          q2: coList[(i * 2 + 1) % coList.length]
        });
      } else {
        distributed.push(coList[i % coList.length]);
      }
    }
    sec.question_cos = distributed;
    setSections(updated);
    showNotification(`Distributed questions across ${coList.length} Course Outcomes for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleResetSectionCOs = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const isInternalChoice = sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice';
    sec.question_cos = new Array(numQ).fill(isInternalChoice ? { q1: 'auto', q2: 'auto' } : 'auto');
    setSections(updated);
    showNotification(`Reset all question target COs to Auto for ${getDynamicSectionName(sections, sectionIdx)}`);
  };

  const handleUpdatePairSubDivision = (sectionIdx, pairIdx, value) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const currentList = Array.isArray(sec.question_sub_divisions) ? [...sec.question_sub_divisions] : [];
    while (currentList.length < numQ) {
      currentList.push(sec.sub_division === 'none' ? 'none' : 'two_subquestions');
    }
    currentList[pairIdx] = value;
    sec.question_sub_divisions = currentList;

    const allTwo = currentList.every(v => v === 'two_subquestions');
    const allNone = currentList.every(v => v === 'none');
    if (allTwo) sec.sub_division = 'two_subquestions';
    else if (allNone) sec.sub_division = 'none';
    else sec.sub_division = 'mixed';

    setSections(updated);
  };

  const handleSetAllPairSubDivisions = (sectionIdx, value) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    sec.sub_division = value;
    sec.question_sub_divisions = new Array(numQ).fill(value);
    setSections(updated);
  };

  const handleSetStandardPairPattern = (sectionIdx) => {
    const updated = [...sections];
    const sec = updated[sectionIdx];
    const numQ = parseInt(sec.questions) || 1;
    const newDivs = [];
    for (let i = 0; i < numQ; i++) {
      if (i < numQ - 1) {
        newDivs.push('two_subquestions');
      } else {
        newDivs.push('none');
      }
    }
    sec.sub_division = numQ > 1 ? 'mixed' : 'none';
    sec.question_sub_divisions = newDivs;
    setSections(updated);
    showNotification(`Section configured: Questions 1-${Math.max(1, numQ - 1)} with Sub-questions and Question ${numQ} as Single Question.`);
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
        setCoDetectionStatus('found');
        setNewCoId(`CO${res.outcomes.length + 1}`);
        showNotification(res.message || `✓ Automatically extracted ${res.outcomes.length} Course Outcomes from documents!`);
      } else {
        setCoDetectionStatus('not_found');
        showNotification(
          res.message || '⚠️ No Course Outcomes (COs) detected in the uploaded documents. Please add them manually or click Auto-Generate.',
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
  const handleAutoGenerateCOsFromCourse = () => {
    const currentCourse = courses.find(c => String(c.id) === String(selectedCourse));
    const cName = currentCourse ? currentCourse.course_name : 'the course domain';
    
    const generated = [
      { id: 'CO1', description: `Explain foundational principles, architectural models, and core concepts in ${cName}`, bloom_level: 'Understand', unit: 'Unit 1' },
      { id: 'CO2', description: `Apply design patterns, methods, and practical frameworks to solve standard problems in ${cName}`, bloom_level: 'Apply', unit: 'Unit 2' },
      { id: 'CO3', description: `Analyze component hierarchies, data structures, and computational workflows in ${cName}`, bloom_level: 'Analyze', unit: 'Unit 3' },
      { id: 'CO4', description: `Evaluate error handling, synchronization, resource constraints, and performance bottlenecks in ${cName}`, bloom_level: 'Evaluate', unit: 'Unit 4' },
      { id: 'CO5', description: `Synthesize modular and scalable solutions adhering to industry specifications for ${cName}`, bloom_level: 'Create', unit: 'Unit 5' }
    ];

    setOutcomes(generated);
    setCoDetectionStatus('found');
    setNewCoId('CO6');
    showNotification(`🪄 Auto-generated 5 syllabus-aligned Course Outcomes for ${cName}!`);
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
    setNewCoId('CO6');
    setCoDetectionStatus('idle');
    showNotification('Reset to standard Bloom-mapped Course Outcomes');
  };

  // Topics Management
  const handleAddTopic = () => {
    if (!newTopicName.trim()) {
      showNotification('Please enter topic or chapter name', 'error');
      return;
    }
    const newTopic = {
      id: Date.now(),
      name: newTopicName.trim(),
      weight: parseInt(newTopicWeight) || 25
    };
    setTopics([...topics, newTopic]);
    setNewTopicName('');
    setNewTopicWeight(25);
  };

  const handleDeleteTopic = (index) => {
    if (topics.length <= 1) {
      showNotification('Exam blueprint must contain at least one topic', 'error');
      return;
    }
    setTopics(topics.filter((_, i) => i !== index));
  };

  const handleUpdateTopicWeight = (index, weight) => {
    const updated = [...topics];
    updated[index].weight = Math.max(1, parseInt(weight) || 1);
    setTopics(updated);
  };

  const handlePreloadDefaultTopics = () => {
    const currentCourse = courses.find(c => String(c.id) === String(selectedCourse));
    const courseName = currentCourse ? currentCourse.course_name : 'Computer Science';
    setTopics([
      { id: 1, name: `${courseName}: Fundamentals & Core Concepts`, weight: 25 },
      { id: 2, name: `${courseName}: Algorithmic Paradigms & Analysis`, weight: 25 },
      { id: 3, name: `${courseName}: Practical System Architectures`, weight: 25 },
      { id: 4, name: `${courseName}: Performance Evaluation & Trade-offs`, weight: 25 }
    ]);
    showNotification('Preloaded standardized topics for this course!');
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
        exam_date: examDate,
        special_instructions: specialInstructions,
        sections: sections
          .filter(s => s.type !== 'None')
          .map((s, activeIdx) => ({
            name: `Section ${String.fromCharCode(65 + activeIdx)}`,
            type: s.type,
            questions: s.questions,
            marks_per_q: s.marks_per_q,
            choice_mode: s.choice_mode || 'none',
            sub_division: s.sub_division || (s.type === 'Long Answer' ? 'two_subquestions' : 'none'),
            question_sub_divisions: s.question_sub_divisions || [],
            question_cos: s.question_cos || []
          })),
        topics: topics.map(t => ({ name: t.name, weight: t.weight })),
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
        showNotification('Question Paper successfully saved to department archives!');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to save paper', 'error');
    } finally {
      setSaving(false);
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
                label="Exam Date"
                name="examDate"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                placeholder="e.g. Sep 13, 2026"
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
                label="Academic Year"
                name="academicYear"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024-25"
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

              {/* Direct Material Textarea */}
              <div>
                <div className="material-editor-label">
                  <span>Edit / Paste Material Text directly:</span>
                  {materialText && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setMaterialText('')}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#ef4444' }}
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <div className="material-textarea-wrapper">
                  <textarea
                    className="material-textarea"
                    placeholder="Paste course notes, study sheets, chapter text, or syllabus content here..."
                    value={materialText}
                    onChange={(e) => setMaterialText(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="material-counters-bar">
                  <div>Words: <span>{wordCount}</span></div>
                  <div>Characters: <span>{charCount.toLocaleString()}</span></div>
                </div>
              </div>

              {/* Reference Documents Browser */}
              <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9' }}>
                      <span>📚</span>
                      <span>Available Reference Documents ({docScope === 'course' ? courseDocuments.length : allDocuments.length})</span>
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                      Click directly on any document card to select or remove it for AI question generation.
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
                        onClick={handleSelectAllDocs}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                        title="Select all documents in this category"
                      >
                        ⚡ Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearDocSelections}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                        title="Deselect all documents"
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
                      {selectedDocIds.length} selected for AI
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
                    ℹ️ No uploaded reference files found in this category. You can drag and drop files above or paste material directly.
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
                          title={isSelected ? 'Click to deselect/remove from AI generation' : 'Click to select for AI generation'}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, marginRight: '6px' }}>
                                <input
                                  type="checkbox"
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
                    gridTemplateColumns: sec.type === 'Long Answer' ? '1.1fr 0.7fr 0.7fr 1.2fr 1.3fr' : '1.5fr 1fr 1fr',
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
                      <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Marks / Q</label>
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

                    {sec.type === 'Long Answer' && (
                      <div>
                        <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px', color: '#93c5fd', fontWeight: 600 }}>
                          🧩 Default Sub-division
                        </label>
                        <select
                          className="form-control"
                          value={sec.sub_division === 'mixed' ? 'mixed' : (sec.sub_division || 'two_subquestions')}
                          onChange={(e) => {
                            if (e.target.value === 'standard') {
                              handleSetStandardPairPattern(sIdx);
                            } else if (e.target.value !== 'mixed') {
                              handleSetAllPairSubDivisions(sIdx, e.target.value);
                            }
                          }}
                          style={{
                            borderColor: 'rgba(59, 130, 246, 0.4)',
                            background: 'rgba(30, 58, 138, 0.15)',
                            color: '#e2e8f0',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}
                        >
                          <option value="two_subquestions">
                            All 2 Sub-questions ({Math.ceil(marksPerQ / 2)}M + {marksPerQ - Math.ceil(marksPerQ / 2)}M)
                          </option>
                          <option value="none">
                            All None (Single {marksPerQ}M Question)
                          </option>
                          <option value="standard">
                            Standard Pattern (Sub-Qs + Single)
                          </option>
                          {sec.sub_division === 'mixed' && (
                            <option value="mixed" disabled>
                              Custom / Mixed per Question
                            </option>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Per-Question Sub-division Customizer for Long Answers */}
                    {sec.type === 'Long Answer' && !isNone && (
                      <div style={{
                        gridColumn: '1 / -1',
                        marginTop: '12px',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: 'rgba(30, 58, 138, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.25)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.05rem' }}>🧩</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#93c5fd' }}>
                              Question-by-Question Sub-divisions (Q{qRange.startQ} to Q{qRange.endQ})
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {sec.choice_mode === 'internal_choice'
                                ? `${numQuestions} Pairs with Choice (${numQuestions * 2} Questions Total)`
                                : `${numQuestions} Direct Questions (No Internal Choice)`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetStandardPairPattern(sIdx)}
                              style={{ fontSize: '0.74rem', padding: '3px 9px', background: 'rgba(59, 130, 246, 0.25)', borderColor: 'rgba(59, 130, 246, 0.5)', color: '#93c5fd', fontWeight: 600 }}
                              title="Set Questions 1 to N-1 as 2 sub-questions (a & b) and final Question as Single Question"
                            >
                              ⚡ Standard (Q{qRange.startQ}-{Math.max(qRange.startQ, qRange.endQ - (sec.choice_mode === 'internal_choice' ? 2 : 1))} Sub-Qs + Single Q)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetAllPairSubDivisions(sIdx, 'two_subquestions')}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                            >
                              ⚡ All 2 Sub-questions
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetAllPairSubDivisions(sIdx, 'none')}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                            >
                              ⚡ All Single Questions
                            </button>
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: numQuestions > 2 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr 1fr',
                          gap: '10px'
                        }}>
                          {Array.from({ length: numQuestions }).map((_, qIdx) => {
                            const isInternalChoice = sec.choice_mode === 'internal_choice';
                            const q1 = isInternalChoice ? qRange.startQ + qIdx * 2 : qRange.startQ + qIdx;
                            const q2 = isInternalChoice ? q1 + 1 : null;
                            const itemVal = (sec.question_sub_divisions && sec.question_sub_divisions[qIdx]) || sec.sub_division || 'two_subquestions';
                            const p1 = Math.ceil(marksPerQ / 2);
                            const p2 = marksPerQ - p1;

                            return (
                              <div
                                key={qIdx}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  background: 'rgba(15, 23, 42, 0.6)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#e2e8f0' }}>
                                    {isInternalChoice ? (
                                      <>Choice Pair {qIdx + 1}: <strong style={{ color: '#38bdf8' }}>Q{q1} OR Q{q2}</strong></>
                                    ) : (
                                      <>Question {qIdx + 1}: <strong style={{ color: '#38bdf8' }}>Q{q1}</strong></>
                                    )}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    [{marksPerQ}M]
                                  </span>
                                </div>
                                <select
                                  className="form-control"
                                  value={itemVal}
                                  onChange={(e) => handleUpdatePairSubDivision(sIdx, qIdx, e.target.value)}
                                  style={{
                                    fontSize: '0.8rem',
                                    padding: '5px 8px',
                                    background: 'rgba(30, 41, 59, 0.8)',
                                    color: '#f8fafc',
                                    borderColor: itemVal === 'two_subquestions' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.15)'
                                  }}
                                >
                                  {isInternalChoice ? (
                                    <>
                                      <option value="two_subquestions">
                                        2 Sub-questions ({q1}.a, {q1}.b OR {q2}.a, {q2}.b) [{p1}M + {p2}M]
                                      </option>
                                      <option value="none">
                                        Single Question ({q1} OR {q2}) [{marksPerQ}M]
                                      </option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="two_subquestions">
                                        2 Sub-questions ({q1}.a & {q1}.b) [{p1}M + {p2}M]
                                      </option>
                                      <option value="none">
                                        Single Question (Q{q1}) [{marksPerQ}M]
                                      </option>
                                    </>
                                  )}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Question-wise Target Course Outcome (CO) Mapping */}
                    {!isNone && (
                      <div style={{
                        gridColumn: '1 / -1',
                        marginTop: '12px',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: 'rgba(14, 165, 233, 0.08)',
                        border: '1px solid rgba(14, 165, 233, 0.22)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.05rem' }}>🎯</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8' }}>
                              Target Course Outcome (CO) Mapping per Question
                            </span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              (Select which CO each question in this section should target)
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleAutoDistributeSectionCOs(sIdx)}
                              style={{ fontSize: '0.74rem', padding: '3px 8px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                              title="Distribute questions evenly across available COs"
                            >
                              ⚡ Auto-Distribute COs
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleResetSectionCOs(sIdx)}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                              title="Reset all questions in this section to Auto balance"
                            >
                              🔄 Reset to Auto
                            </button>
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: numQuestions > 2 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr 1fr',
                          gap: '10px'
                        }}>
                          {Array.from({ length: numQuestions }).map((_, qIdx) => {
                            const isInternalChoice = sec.type === 'Long Answer' && sec.choice_mode === 'internal_choice';
                            const q1 = isInternalChoice ? qRange.startQ + qIdx * 2 : qRange.startQ + qIdx;
                            const q2 = isInternalChoice ? q1 + 1 : null;

                            if (isInternalChoice) {
                              const rawVal = (sec.question_cos && sec.question_cos[qIdx]) || {};
                              const q1CO = (typeof rawVal === 'object' && rawVal !== null ? rawVal.q1 : rawVal) || 'auto';
                              const q2CO = (typeof rawVal === 'object' && rawVal !== null ? rawVal.q2 : rawVal) || 'auto';

                              return (
                                <div
                                  key={qIdx}
                                  style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '4px' }}>
                                    <span style={{ color: '#93c5fd' }}>Choice Pair {qIdx + 1}: <strong style={{ color: '#38bdf8' }}>Q{q1} OR Q{q2}</strong></span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>[{marksPerQ}M]</span>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {/* Question 1 in pair */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', fontWeight: 600 }}>
                                        <span style={{ color: '#f1f5f9' }}>Q{q1}</span>
                                        <span style={{ fontSize: '0.7rem', color: q1CO !== 'auto' ? '#38bdf8' : 'var(--text-muted)' }}>
                                          {q1CO !== 'auto' ? q1CO : 'Auto'}
                                        </span>
                                      </div>
                                      <select
                                        className="form-control"
                                        value={q1CO}
                                        onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q1', e.target.value)}
                                        style={{
                                          fontSize: '0.76rem',
                                          padding: '4px 6px',
                                          background: 'rgba(30, 41, 59, 0.9)',
                                          color: q1CO !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                          borderColor: q1CO !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)'
                                        }}
                                      >
                                        <option value="auto">Auto (Balanced)</option>
                                        {outcomes.map(oc => (
                                          <option key={oc.id} value={oc.id}>
                                            {oc.id} ({oc.unit || oc.bloom_level})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Question 2 in pair */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', fontWeight: 600 }}>
                                        <span style={{ color: '#f1f5f9' }}>Q{q2} (OR)</span>
                                        <span style={{ fontSize: '0.7rem', color: q2CO !== 'auto' ? '#38bdf8' : 'var(--text-muted)' }}>
                                          {q2CO !== 'auto' ? q2CO : 'Auto'}
                                        </span>
                                      </div>
                                      <select
                                        className="form-control"
                                        value={q2CO}
                                        onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, 'q2', e.target.value)}
                                        style={{
                                          fontSize: '0.76rem',
                                          padding: '4px 6px',
                                          background: 'rgba(30, 41, 59, 0.9)',
                                          color: q2CO !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                          borderColor: q2CO !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)'
                                        }}
                                      >
                                        <option value="auto">Auto (Balanced)</option>
                                        {outcomes.map(oc => (
                                          <option key={oc.id} value={oc.id}>
                                            {oc.id} ({oc.unit || oc.bloom_level})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Direct Question (No choice)
                            const currentCO = typeof sec.question_cos?.[qIdx] === 'object' && sec.question_cos[qIdx] !== null
                              ? sec.question_cos[qIdx].q1 || 'auto'
                              : (sec.question_cos && sec.question_cos[qIdx]) || 'auto';

                            return (
                              <div
                                key={qIdx}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.65)',
                                  border: currentCO !== 'auto' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '6px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                                  <span style={{ color: '#f1f5f9' }}>Question {q1}</span>
                                  <span style={{ fontSize: '0.72rem', color: currentCO !== 'auto' ? '#38bdf8' : 'var(--text-muted)' }}>
                                    {currentCO !== 'auto' ? currentCO : 'Auto'}
                                  </span>
                                </div>
                                <select
                                  className="form-control"
                                  value={currentCO}
                                  onChange={(e) => handleUpdateQuestionCO(sIdx, qIdx, e.target.value)}
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '4px 6px',
                                    background: 'rgba(30, 41, 59, 0.8)',
                                    color: currentCO !== 'auto' ? '#38bdf8' : '#e2e8f0',
                                    borderColor: currentCO !== 'auto' ? '#0284c7' : 'rgba(255, 255, 255, 0.15)'
                                  }}
                                >
                                  <option value="auto">Auto (Balanced)</option>
                                  {outcomes.map(oc => (
                                    <option key={oc.id} value={oc.id}>
                                      {oc.id} ({oc.unit || oc.bloom_level})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
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

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExtractCOsFromDocuments}
                  disabled={extractingCOs}
                  style={{ fontSize: '0.82rem', padding: '6px 14px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                  title="Scan uploaded documents / syllabus text to extract explicit COs"
                >
                  {extractingCOs ? '⚡ Extracting...' : '🪄 Auto-Extract from Documents'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoGenerateCOsFromCourse}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  title="Generate standard OBE Course Outcomes tailored to this course"
                >
                  🪄 Auto-Generate from Course
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetOutcomes}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  ⚡ Preload Standard COs
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
                    You can add your Course Outcomes manually using the form below, or click <strong>"🪄 Auto-Generate from Course"</strong> to populate tailored COs automatically.
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
                gap: '10px'
              }}>
                <span>✓</span>
                <span>Course Outcomes successfully configured and mapped to syllabus units!</span>
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
                    {['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'].map(u => (
                      <option key={u} value={u}>{u}</option>
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
                      value={coItem.unit || `Unit ${min(5, index + 1)}`}
                      onChange={(e) => handleUpdateOutcomeText(index, 'unit', e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                    >
                      {['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'].map(u => (
                        <option key={u} value={u}>{u}</option>
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  📖 Chapter & Topic Weightage Allocation
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Distribute relative conceptual weightage across units. Questions will be synthesized according to these proportions.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePreloadDefaultTopics}
              >
                ⚡ Preload Course Topics
              </button>
            </div>

            {/* Total Weight Progress Bar */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
                <span>Total Topic Weight:</span>
                <strong style={{ color: totalTopicWeight === 100 ? '#10b981' : '#f59e0b' }}>
                  {totalTopicWeight}% {totalTopicWeight === 100 ? '(Balanced)' : '(Recommended: 100%)'}
                </strong>
              </div>
              <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, totalTopicWeight)}%`, height: '100%', background: totalTopicWeight === 100 ? '#10b981' : '#f59e0b', transition: 'all 0.3s ease' }} />
              </div>
            </div>

            {/* Add New Topic Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: '12px', marginBottom: '20px', alignItems: 'end' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Topic / Chapter Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g. Exception Handling & Multithreading Synchronizations"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Weightage (%)</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddTopic}
                style={{ fontSize: '0.85rem', padding: '9px 18px' }}
              >
                + Add Topic
              </button>
            </div>

            {/* Topics List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topics.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 40px',
                    gap: '14px',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f1f5f9' }}>
                    {t.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      className="form-control"
                      value={t.weight}
                      onChange={(e) => handleUpdateTopicWeight(idx, e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '4px 8px', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                  <button
                    type="button"
                    className="blueprint-icon-btn"
                    onClick={() => handleDeleteTopic(idx)}
                    title="Delete Topic"
                  >
                    🗑️
                  </button>
                </div>
              ))}
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
                  <a
                    href={documentService.getDownloadUrl(previewDoc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 10px', textDecoration: 'none' }}
                  >
                    📥 Download Original File
                  </a>
                )}
              </div>
            </>
          )}

          <div className="modal-footer" style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {previewDoc && (
              <button
                type="button"
                className={`btn ${selectedDocIds.includes(previewDoc.id) ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => toggleDocSelection(previewDoc.id)}
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
            <div style={{ display: 'flex', gap: '10px' }}>
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
                {saving ? 'Saving...' : '💾 Save to Department Archive'}
              </button>
            </div>
          </div>

          {/* Formatted Question Paper Sheet */}
          <div id="printable-question-paper" className="printable-paper-sheet glass-card" style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '44px 50px',
            borderRadius: '8px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)'
          }}>
            {/* Header */}
            <div className="printable-paper-header" style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a', textTransform: 'uppercase' }}>
                {generatedPaper.institution_name}
              </h2>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                {generatedPaper.department_name}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '8px', color: '#1e293b' }}>
                {generatedPaper.title} - Academic Year {generatedPaper.academic_year}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="printable-metadata-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.92rem', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px' }}>
              <div><strong>Course: </strong>{generatedPaper.course_name} ({generatedPaper.course_code})</div>
              <div style={{ textAlign: 'right' }}><strong>Semester: </strong>{generatedPaper.semester}</div>
              <div><strong>Duration: </strong>{generatedPaper.duration}</div>
              <div style={{ textAlign: 'right' }}><strong>Max. Marks: </strong>{generatedPaper.total_marks}</div>
              <div><strong>Date: </strong>{generatedPaper.exam_date || examDate}</div>
            </div>

            {/* Special Instructions */}
            {generatedPaper.special_instructions && (
              <div className="printable-instructions-box" style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#475569',
                marginBottom: '24px',
                whiteSpace: 'pre-line'
              }}>
                <strong>Instructions:</strong><br />
                {generatedPaper.special_instructions}
              </div>
            )}

            {/* Sections */}
            {generatedPaper.sections && generatedPaper.sections.map((section, sIdx) => (
              <div key={sIdx} style={{ marginBottom: '32px' }}>
                <div className="printable-section-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: '#f1f5f9',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginBottom: '6px',
                  color: '#1e293b'
                }}>
                  <span>{section.section_name} ({section.section_type || 'General'})</span>
                  <span>[{section.section_marks} Marks]</span>
                </div>
                <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#64748b', marginBottom: '14px' }}>
                  {section.instruction}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {section.questions && section.questions.map((q, qIdx) => {
                    const isChoice = q.has_internal_choice || 
                      (q.q_no && String(q.q_no).toLowerCase().includes('or')) || 
                      (q.question && (/\[OR\]|\(OR\)/i).test(q.question));

                    const orParts = q.question ? q.question.split(/\s*(?:\[OR\]|\(OR\))\s*/i) : [];
                    const hasChoiceParts = isChoice && orParts.length >= 2;

                    let q1No = q.q1_no;
                    let q2No = q.q2_no;
                    if (!q1No || !q2No) {
                      if (q.q_no && String(q.q_no).toLowerCase().includes('or')) {
                        const parts = String(q.q_no).split(/\s*(?:or|\/)\s*/i);
                        q1No = q1No || parts[0]?.trim();
                        q2No = q2No || parts[1]?.trim();
                      } else if (q.q_no && String(q.q_no).includes('/')) {
                        const parts = String(q.q_no).split(/\s*\/\s*/i);
                        q1No = q1No || parts[0]?.trim();
                        q2No = q2No || parts[1]?.trim();
                      } else if (q.q_no && !isNaN(parseInt(q.q_no, 10))) {
                        const num = parseInt(q.q_no, 10);
                        q1No = q1No || `${num}`;
                        q2No = q2No || `${num + 1}`;
                      }
                    }

                    const cleanQ1 = q1No ? String(q1No).replace(/^Q\s*/i, '').replace(/\.+$/, '').trim() : '';
                    const cleanQ2 = q2No ? String(q2No).replace(/^Q\s*/i, '').replace(/\.+$/, '').trim() : '';
                    const cleanSingle = q.q_no ? String(q.q_no).replace(/^Q\s*/i, '').replace(/\.+$/, '').trim() : `${qIdx + 1}`;

                    const part1 = orParts[0]?.trim() || '';
                    const part2 = orParts.slice(1).join('\n\n                                    [OR]\n\n').trim() || '';

                    if (hasChoiceParts) {
                      return (
                        <div key={qIdx} className="printable-choice-block" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '10px 0 14px 0',
                          borderBottom: '1px dashed #cbd5e1'
                        }}>
                          {/* Part 1: Question 1 (e.g. Q8) */}
                          <div className="printable-question-row" style={{
                            display: 'grid',
                            gridTemplateColumns: '70px 1fr 190px',
                            gap: '12px',
                            alignItems: 'start'
                          }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                              <span>Q{cleanQ1 || 'A'}.</span>
                            </div>
                            <div>
                              <textarea
                                className="screen-only-textarea"
                                value={part1}
                                onChange={(e) => {
                                  const updated = `${e.target.value}\n\n                                    [OR]\n\n${part2}`;
                                  handleQuestionTextChange(sIdx, qIdx, updated);
                                }}
                                style={{
                                  width: '100%',
                                  border: '1px solid transparent',
                                  backgroundColor: 'transparent',
                                  color: '#0f172a',
                                  fontFamily: 'inherit',
                                  fontSize: '0.92rem',
                                  lineHeight: 1.5,
                                  resize: 'vertical',
                                  padding: '4px',
                                  whiteSpace: 'pre-wrap'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                rows={Math.max(2, part1.split('\n').length + 1)}
                              />
                              <div className="print-only-text" style={{ display: 'none', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {part1}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#475569' }}>
                              <span style={{ fontWeight: 800, color: '#0f172a' }}>[{q.marks}M]</span>
                              {(q.q1_bloom || q.bloom_level) && <span> • {q.q1_bloom || q.bloom_level}</span>}
                              <span className="no-print" style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                                <select
                                  value={q.q1_co || q.co || 'CO1'}
                                  onChange={(e) => handleQuestionCOChange(sIdx, qIdx, e.target.value, 'q1')}
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0284c7',
                                    border: '1px solid #7dd3fc',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    outline: 'none'
                                  }}
                                  title="Select Course Outcome (CO) for Question 1"
                                >
                                  {outcomes.map(oc => (
                                    <option key={oc.id} value={oc.id}>
                                      {oc.id} ({oc.unit || oc.bloom_level})
                                    </option>
                                  ))}
                                  {(q.q1_co || q.co) && !outcomes.some(oc => oc.id === (q.q1_co || q.co)) && (
                                    <option value={q.q1_co || q.co}>{q.q1_co || q.co}</option>
                                  )}
                                </select>
                              </span>
                              <span className="print-only-text" style={{
                                display: 'none',
                                marginLeft: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#e0f2fe',
                                color: '#0284c7',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}>
                                {q.q1_co || q.co || 'CO1'}
                              </span>
                            </div>
                          </div>

                          {/* Centered OR Divider */}
                          <div className="printable-or-divider" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '8px 0',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              left: '70px',
                              right: '190px',
                              top: '50%',
                              borderTop: '1px dashed #cbd5e1',
                              zIndex: 0
                            }} />
                            <span style={{
                              position: 'relative',
                              zIndex: 1,
                              backgroundColor: '#ffffff',
                              padding: '0 18px',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: '#334155',
                              letterSpacing: '2px'
                            }}>
                              [ OR ]
                            </span>
                          </div>

                          {/* Part 2: Question 2 (e.g. Q9) */}
                          <div className="printable-question-row" style={{
                            display: 'grid',
                            gridTemplateColumns: '70px 1fr 190px',
                            gap: '12px',
                            alignItems: 'start'
                          }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                              <span>Q{cleanQ2 || 'B'}.</span>
                            </div>
                            <div>
                              <textarea
                                className="screen-only-textarea"
                                value={part2}
                                onChange={(e) => {
                                  const updated = `${part1}\n\n                                    [OR]\n\n${e.target.value}`;
                                  handleQuestionTextChange(sIdx, qIdx, updated);
                                }}
                                style={{
                                  width: '100%',
                                  border: '1px solid transparent',
                                  backgroundColor: 'transparent',
                                  color: '#0f172a',
                                  fontFamily: 'inherit',
                                  fontSize: '0.92rem',
                                  lineHeight: 1.5,
                                  resize: 'vertical',
                                  padding: '4px',
                                  whiteSpace: 'pre-wrap'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
                                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                rows={Math.max(2, part2.split('\n').length + 1)}
                              />
                              <div className="print-only-text" style={{ display: 'none', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {part2}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#475569' }}>
                              <span style={{ fontWeight: 800, color: '#0f172a' }}>[{q.marks}M]</span>
                              {(q.q2_bloom || q.bloom_level) && <span> • {q.q2_bloom || q.bloom_level}</span>}
                              <span className="no-print" style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                                <select
                                  value={q.q2_co || q.co || 'CO2'}
                                  onChange={(e) => handleQuestionCOChange(sIdx, qIdx, e.target.value, 'q2')}
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0284c7',
                                    border: '1px solid #7dd3fc',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    outline: 'none'
                                  }}
                                  title="Select Course Outcome (CO) for Question 2 (Internal Choice)"
                                >
                                  {outcomes.map(oc => (
                                    <option key={oc.id} value={oc.id}>
                                      {oc.id} ({oc.unit || oc.bloom_level})
                                    </option>
                                  ))}
                                  {(q.q2_co || q.co) && !outcomes.some(oc => oc.id === (q.q2_co || q.co)) && (
                                    <option value={q.q2_co || q.co}>{q.q2_co || q.co}</option>
                                  )}
                                </select>
                              </span>
                              <span className="print-only-text" style={{
                                display: 'none',
                                marginLeft: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#e0f2fe',
                                color: '#0284c7',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}>
                                {q.q2_co || q.co || 'CO2'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={qIdx} className="printable-question-row" style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 190px',
                        gap: '12px',
                        alignItems: 'start',
                        padding: '12px 0',
                        borderBottom: '1px dashed #e2e8f0'
                      }}>
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                          <span>Q{cleanSingle}.</span>
                        </div>
                        <div>
                          <textarea
                            className="screen-only-textarea"
                            value={q.question}
                            onChange={(e) => handleQuestionTextChange(sIdx, qIdx, e.target.value)}
                            style={{
                              width: '100%',
                              border: '1px solid transparent',
                              backgroundColor: 'transparent',
                              color: '#0f172a',
                              fontFamily: 'inherit',
                              fontSize: '0.92rem',
                              lineHeight: 1.5,
                              resize: 'vertical',
                              padding: '4px',
                              whiteSpace: 'pre-wrap'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                            rows={q.type === 'MCQ' ? 5 : q.type === 'Long Answer' ? 6 : 2}
                          />
                          <div className="print-only-text" style={{ display: 'none', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {q.question}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#475569' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>[{q.marks}M]</span>
                          {q.bloom_level && <span> • {q.bloom_level}</span>}
                          <span className="no-print" style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                            <select
                              value={q.co || 'CO1'}
                              onChange={(e) => handleQuestionCOChange(sIdx, qIdx, e.target.value)}
                              style={{
                                background: '#e0f2fe',
                                color: '#0284c7',
                                border: '1px solid #7dd3fc',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                              title="Select Course Outcome (CO) for this question"
                            >
                              {outcomes.map(oc => (
                                <option key={oc.id} value={oc.id}>
                                  {oc.id} ({oc.unit || oc.bloom_level})
                                </option>
                              ))}
                              {q.co && !outcomes.some(oc => oc.id === q.co) && (
                                <option value={q.co}>{q.co}</option>
                              )}
                            </select>
                          </span>
                          <span className="print-only-text" style={{
                            display: 'none',
                            marginLeft: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            fontWeight: 700,
                            fontSize: '0.78rem'
                          }}>
                            {q.co || 'CO1'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

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
        </div>
      )}
    </div>
  );
};

export default QPGenerator;
