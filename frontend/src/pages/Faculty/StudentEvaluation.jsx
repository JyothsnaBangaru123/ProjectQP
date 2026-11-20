import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { regulationService } from '../../services/regulationService';
import Loader from '../../components/common/Loader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import './StudentEvaluation.css';

const StudentEvaluation = () => {
  const navigate = useNavigate();
  const { user, isFaculty, loading: authLoading } = useAuth();

  // Primary Data Sources
  const [regulations, setRegulations] = useState([]);
  const [coursesWithPapers, setCoursesWithPapers] = useState([]);
  const [papersList, setPapersList] = useState([]);
  const [savedStudents, setSavedStudents] = useState([]);

  // Faculty Inputs / Selection State
  const [selectedRegulationId, setSelectedRegulationId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [activePaper, setActivePaper] = useState(null);

  // Student Input Fields
  const [jntuNo, setJntuNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Evaluated questions state map:
  // key: question item identifier (e.g. "sec0_q0" or "sec1_q0_opt1")
  // value: { attempted: boolean, marksAwarded: number, maxMarks: number, qLabel: string, sectionName: string, choiceParent: string|null }
  const [evaluations, setEvaluations] = useState({});

  // UI States
  const [loading, setLoading] = useState(true);
  const [papersLoading, setPapersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSavedTable, setShowSavedTable] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [tableCourseFilter, setTableCourseFilter] = useState('all');

  // 1. Initial Load: Fetch Regulations and Courses with Generated Papers
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [regRes, coursesRes] = await Promise.all([
          regulationService.getAll(),
          studentService.getCoursesWithPapers()
        ]);

        if (regRes.success) {
          setRegulations(regRes.data || []);
        }
        if (coursesRes.success) {
          setCoursesWithPapers(coursesRes.data || []);
          // Auto-select first course if available
          if (coursesRes.data && coursesRes.data.length > 0) {
            const first = coursesRes.data[0];
            setSelectedCourseId(String(first.id));
            if (first.reg_id) {
              setSelectedRegulationId(String(first.reg_id));
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize evaluation portal.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // 2. When Regulation Changes, reload courses with papers filtered by regulation
  const handleRegulationChange = async (e) => {
    const regId = e.target.value;
    setSelectedRegulationId(regId);
    setSelectedCourseId('');
    setSelectedPaperId('');
    setActivePaper(null);
    setEvaluations({});

    try {
      const res = await studentService.getCoursesWithPapers(regId ? { regulation_id: regId } : {});
      if (res.success) {
        setCoursesWithPapers(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedCourseId(String(res.data[0].id));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to filter courses by regulation');
    }
  };

  // 3. When Course Changes, fetch question papers generated for this course
  useEffect(() => {
    if (!selectedCourseId) {
      setPapersList([]);
      setActivePaper(null);
      setEvaluations({});
      return;
    }

    const loadPapers = async () => {
      setPapersLoading(true);
      try {
        const res = await studentService.getPapersByCourse(selectedCourseId);
        if (res.success && res.data && res.data.length > 0) {
          setPapersList(res.data);
          // Auto-select the first (most recent) paper
          const paper = res.data[0];
          setSelectedPaperId(String(paper.id));
          setActivePaper(paper);
          initializeEvaluations(paper);
        } else {
          setPapersList([]);
          setActivePaper(null);
          setEvaluations({});
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch question papers for selected course');
      } finally {
        setPapersLoading(false);
      }
    };

    loadPapers();
    fetchSavedStudents();
  }, [selectedCourseId]);

  // 4. Fetch saved students from database
  const fetchSavedStudents = async (filterCourse) => {
    try {
      const activeFilter = filterCourse !== undefined ? filterCourse : tableCourseFilter;
      const params = {};
      if (activeFilter && activeFilter !== 'all') {
        params.course_id = activeFilter;
      }
      const res = await studentService.getAll(params);
      if (res.success) {
        setSavedStudents(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load students table:', err);
    }
  };

  // Initialize all questions in paper pattern to unattempted / None (0 marks)
  const initializeEvaluations = (paper) => {
    if (!paper || !paper.pattern_sections) return;
    const initialMap = {};

    paper.pattern_sections.forEach((sec) => {
      sec.questions?.forEach((q) => {
        if (q.is_choice && q.options) {
          q.options.forEach((opt) => {
            const subqs = (opt.subquestions && opt.subquestions.length > 0)
              ? opt.subquestions
              : [{ sub_key: opt.option_key, sub_label: opt.q_label, max_marks: opt.marks, co: 'CO1' }];

            subqs.forEach((sub) => {
              initialMap[sub.sub_key] = {
                attempted: false,
                marksAwarded: 0,
                maxMarks: sub.max_marks,
                qLabel: sub.sub_label,
                sectionName: sec.section_name,
                isChoice: true,
                choiceParent: q.id,
                optionKey: opt.option_key,
                co: sub.co || 'CO1'
              };
            });
          });
        } else {
          const subqs = (q.subquestions && q.subquestions.length > 0)
            ? q.subquestions
            : [{ sub_key: q.id, sub_label: q.q_label, max_marks: q.max_marks, co: 'CO1' }];

          subqs.forEach((sub) => {
            initialMap[sub.sub_key] = {
              attempted: false,
              marksAwarded: 0,
              maxMarks: sub.max_marks,
              qLabel: sub.sub_label,
              sectionName: sec.section_name,
              isChoice: false,
              choiceParent: null,
              optionKey: null,
              co: sub.co || 'CO1'
            };
          });
        }
      });
    });

    setEvaluations(initialMap);
  };

  // When Faculty changes paper selection dropdown
  const handlePaperChange = (e) => {
    const pId = e.target.value;
    setSelectedPaperId(pId);
    const paper = papersList.find((p) => String(p.id) === String(pId));
    setActivePaper(paper || null);
    if (paper) {
      initializeEvaluations(paper);
    }
  };

  // Helper flag: True only when faculty has entered an exact 10-character alphanumeric JNTU number
  const isJntuEntered = Boolean(
    jntuNo &&
    jntuNo.trim().length === 10 &&
    /^[A-Z0-9]{10}$/.test(jntuNo.trim())
  );

  // Toggle question status (both internal choice options can be attempted!)
  const handleToggleQuestion = (key) => {
    if (!isJntuEntered) {
      setError('Please enter a valid 10-character alphanumeric JNTU number first before evaluating.');
      return;
    }

    setEvaluations((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const willBeAttempted = !current.attempted;
      const defaultMarks = typeof current.maxMarks === 'number' ? current.maxMarks : 2;
      return {
        ...prev,
        [key]: {
          ...current,
          attempted: willBeAttempted,
          marksAwarded: willBeAttempted ? (Number(current.marksAwarded) > 0 ? current.marksAwarded : defaultMarks) : 0
        }
      };
    });
  };

  // Set specific question explicitly to None (unattempted, 0 marks)
  const handleSetNone = (key) => {
    setEvaluations((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          attempted: false,
          marksAwarded: 0
        }
      };
    });
  };

  // Manual numeric marks entry with automatic clamping to [0, maxMarks]
  const handleMarksInputChange = (key, rawVal, maxM) => {
    if (!isJntuEntered) {
      setError('Please enter a valid 10-character alphanumeric JNTU number first before evaluating.');
      return;
    }

    setEvaluations((prev) => {
      const current = prev[key];
      if (!current) return prev;

      let marksVal = 0;
      let isAttempted = current.attempted;

      if (rawVal === '') {
        marksVal = '';
      } else {
        const parsed = parseFloat(rawVal);
        if (isNaN(parsed)) {
          marksVal = 0;
        } else {
          const max = typeof maxM === 'number' ? maxM : current.maxMarks;
          marksVal = Math.min(Math.max(0, parsed), max);
          isAttempted = true;
        }
      }

      return {
        ...prev,
        [key]: {
          ...current,
          attempted: isAttempted,
          marksAwarded: marksVal
        }
      };
    });
  };

  // Quick Fill Marks across all standard question items
  const handleQuickFillMarks = (ratio = 0.75) => {
    if (!isJntuEntered) {
      setError('Please enter a valid 10-character alphanumeric JNTU number first before evaluating.');
      return;
    }
    if (!activePaper || !activePaper.pattern_sections) return;

    setEvaluations((prev) => {
      const next = { ...prev };
      activePaper.pattern_sections.forEach((sec) => {
        sec.questions?.forEach((q) => {
          if (q.is_choice && q.options) {
            // Attempt Option 1 by default
            const opt1 = q.options[0];
            const opt2 = q.options[1];
            (opt1.subquestions || []).forEach((sub) => {
              if (next[sub.sub_key]) {
                const awarded = Math.round(sub.max_marks * ratio * 2) / 2;
                next[sub.sub_key] = { ...next[sub.sub_key], attempted: true, marksAwarded: awarded };
              }
            });
            // Option 2 unattempted
            (opt2?.subquestions || []).forEach((sub) => {
              if (next[sub.sub_key]) {
                next[sub.sub_key] = { ...next[sub.sub_key], attempted: false, marksAwarded: 0 };
              }
            });
          } else {
            (q.subquestions || []).forEach((sub) => {
              if (next[sub.sub_key]) {
                const awarded = Math.round(sub.max_marks * ratio * 2) / 2;
                next[sub.sub_key] = { ...next[sub.sub_key], attempted: true, marksAwarded: awarded };
              }
            });
          }
        });
      });
      return next;
    });

    const pctLabel = Math.round(ratio * 100);
    showNotification(`⚡ Auto-filled ~${pctLabel}% marks across paper questions!`);
  };

  // Reset all questions to None
  const handleResetAllToNone = () => {
    if (!activePaper) return;
    initializeEvaluations(activePaper);
    showNotification('All questions reset to None (0 Marks).');
  };

  // Check if JNTU.No is already evaluated for this paper
  useEffect(() => {
    if (!jntuNo || jntuNo.trim().length < 5) return;
    const cleanJntu = jntuNo.trim().toUpperCase();
    const existing = savedStudents.find(
      (s) =>
        s.jntu_no?.toUpperCase() === cleanJntu &&
        (!selectedPaperId || String(s.question_paper_id) === String(selectedPaperId))
    );

    if (existing && !studentName && existing.student_name) {
      setStudentName(existing.student_name);
    }
  }, [jntuNo, savedStudents, selectedPaperId]);

  // Load a saved student's evaluation record into the editor
  const handleLoadStudent = (record) => {
    setJntuNo(record.jntu_no || '');
    setStudentName(record.student_name || '');
    setRemarks(record.remarks || '');

    if (record.course_id && String(record.course_id) !== String(selectedCourseId)) {
      setSelectedCourseId(String(record.course_id));
    }
    if (record.regulation_id) {
      setSelectedRegulationId(String(record.regulation_id));
    }
    if (record.question_paper_id) {
      setSelectedPaperId(String(record.question_paper_id));
    }

    // Populate evaluations from record.evaluation_data
    if (Array.isArray(record.evaluation_data) && activePaper) {
      setEvaluations((prev) => {
        const next = { ...prev };
        record.evaluation_data.forEach((item) => {
          if (next[item.q_id]) {
            next[item.q_id] = {
              ...next[item.q_id],
              attempted: !!item.attempted,
              marksAwarded: Number(item.marks_awarded || 0)
            };
          }
        });
        return next;
      });
    }

    showNotification(`Loaded evaluation for ${record.jntu_no}. You can now edit and save changes.`);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Delete saved student record
  const handleDeleteStudent = async () => {
    if (!deleteId) return;
    try {
      const res = await studentService.delete(deleteId);
      if (res.success) {
        showNotification('Student record deleted from database successfully.');
        fetchSavedStudents();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete student record');
    } finally {
      setDeleteId(null);
    }
  };

  // Live Calculated Metrics with Best-of-Choice evaluation
  const {
    attemptedList,
    totalAttemptedCount,
    totalMarksObtained,
    maxTotalMarks,
    percentage,
    choiceSummaries
  } = useMemo(() => {
    const list = [];
    let count = 0;

    // Group choice evaluations by choiceParent -> { optKey: sumMarks }
    const choiceMap = {};
    let directSum = 0;

    Object.entries(evaluations).forEach(([key, val]) => {
      const awarded = typeof val.marksAwarded === 'number'
        ? val.marksAwarded
        : (parseFloat(val.marksAwarded) || 0);

      if (val.attempted) {
        count += 1;
        list.push({ q_id: key, ...val, marksAwarded: awarded });
      }

      if (val.isChoice && val.choiceParent) {
        if (!choiceMap[val.choiceParent]) {
          choiceMap[val.choiceParent] = {};
        }
        const optK = val.optionKey || 'default';
        if (!choiceMap[val.choiceParent][optK]) {
          choiceMap[val.choiceParent][optK] = {
            scored: 0,
            attempted: false
          };
        }
        if (val.attempted) {
          choiceMap[val.choiceParent][optK].attempted = true;
          choiceMap[val.choiceParent][optK].scored += awarded;
        }
      } else {
        if (val.attempted) {
          directSum += awarded;
        }
      }
    });

    let choiceSum = 0;
    const choiceBlockResults = {}; // parentId -> { bestOptKey, bestScore, optScores }

    Object.entries(choiceMap).forEach(([parentId, opts]) => {
      let bestScore = 0;
      let bestKey = null;
      const optScores = {};

      Object.entries(opts).forEach(([optKey, data]) => {
        optScores[optKey] = Number(data.scored.toFixed(2));
        if (data.scored > bestScore || (bestKey === null && data.attempted)) {
          bestScore = data.scored;
          bestKey = optKey;
        }
      });

      choiceSum += bestScore;
      choiceBlockResults[parentId] = {
        bestOptKey: bestKey,
        bestScore: Number(bestScore.toFixed(2)),
        optScores: optScores
      };
    });

    const finalMarks = Number((directSum + choiceSum).toFixed(2));
    const maxMarks = activePaper?.total_marks || 50;
    const pct = maxMarks > 0 ? Number(((finalMarks / maxMarks) * 100).toFixed(2)) : 0;

    return {
      attemptedList: list,
      totalAttemptedCount: count,
      totalMarksObtained: finalMarks,
      maxTotalMarks: maxMarks,
      percentage: pct,
      choiceSummaries: choiceBlockResults
    };
  }, [evaluations, activePaper]);

  // Save Student Evaluation to Database
  const handleSaveEvaluation = async () => {
    if (!isJntuEntered) {
      setError('Please provide a valid 10-character alphanumeric student JNTU number.');
      return;
    }
    if (!selectedCourseId) {
      setError('Please select a course.');
      return;
    }
    if (!selectedPaperId) {
      setError('Please select a question paper to evaluate.');
      return;
    }

    if (totalAttemptedCount === 0) {
      setError('⚠️ No questions have been marked as attempted yet. Please click Attempted, enter marks, or use the Quick Fill buttons before submitting.');
      return;
    }

    setSaving(true);
    setError('');

    // Prepare evaluation payload with sub-question & choice metadata
    const evalPayload = Object.entries(evaluations).map(([key, val]) => ({
      q_id: key,
      q_label: val.qLabel,
      max_marks: val.maxMarks,
      section_name: val.sectionName,
      attempted: Boolean(val.attempted),
      marks_awarded: val.attempted ? (parseFloat(val.marksAwarded) || 0) : 0,
      is_choice: Boolean(val.isChoice),
      choice_parent: val.choiceParent || null,
      option_key: val.optionKey || null,
      co: val.co || 'CO1'
    }));

    const payload = {
      jntu_no: jntuNo.trim().toUpperCase(),
      student_name: studentName.trim() || undefined,
      course_id: parseInt(selectedCourseId, 10),
      question_paper_id: parseInt(selectedPaperId, 10),
      regulation_id: selectedRegulationId ? parseInt(selectedRegulationId, 10) : undefined,
      max_total_marks: maxTotalMarks,
      evaluation_data: evalPayload,
      remarks: remarks.trim() || undefined
    };

    try {
      const res = await studentService.save(payload);
      if (res.success) {
        showNotification(res.message || `Saved evaluation for ${jntuNo.toUpperCase()} successfully!`);
        fetchSavedStudents('all');
        setTableCourseFilter('all');
        // Clear student form for next student entry
        setJntuNo('');
        setStudentName('');
        setRemarks('');
        if (activePaper) {
          initializeEvaluations(activePaper);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save student evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // Helper to generate marks dropdown options in 0.5 increments (0, 0.5, 1, 1.5, ...)
  const renderMarksOptions = (maxMarks) => {
    const opts = [];
    const max = parseFloat(maxMarks) || 0;
    for (let m = 0; m <= max + 0.0001; m += 0.5) {
      const val = Math.round(m * 10) / 10;
      if (val <= max) {
        opts.push(val);
      }
    }
    if (opts.length === 0 || opts[opts.length - 1] < max) {
      opts.push(max);
    }

    return opts.map((val) => (
      <option key={val} value={val}>
        {val}
      </option>
    ));
  };

  // Filtered saved students for the table
  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return savedStudents;
    const term = searchFilter.toLowerCase();
    return savedStudents.filter(
      (s) =>
        s.jntu_no?.toLowerCase().includes(term) ||
        s.student_name?.toLowerCase().includes(term) ||
        s.course_code?.toLowerCase().includes(term)
    );
  }, [savedStudents, searchFilter]);

  if (loading) {
    return <Loader text="Loading Student Marks Evaluation Portal..." />;
  }

  if (!authLoading && !isFaculty) {
    return (
      <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', margin: '40px auto', maxWidth: '640px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Access Restricted to Faculty Members</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          Student marks entry is restricted exclusively to faculty instructors. Administrative, Management, and Department Head users have view access to the complete <strong>Course Outcome (CO) Attainment Analytics</strong>.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/faculty/co-evaluation')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <span>🎯</span>
          <span>Go to CO Attainment Analytics</span>
        </button>
      </div>
    );
  }

  return (
    <div className="student-eval-container">
      {/* 1. Header Banner */}
      <div className="eval-header-card">
        <div>
          <h1 className="eval-header-title">
            <span>📝</span> Student Marks Evaluation Portal
          </h1>
          <p className="eval-header-subtitle">
            Enter marks question-by-question according to the Question Paper pattern and maintain student records in the database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowSavedTable(!showSavedTable)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Toggle the evaluated students database history table at the bottom of the page"
          >
            <span>{showSavedTable ? '👁️' : '📁'}</span>
            <span>{showSavedTable ? 'Hide Saved Evaluations Table' : `View Saved Evaluations (${savedStudents.length})`}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          padding: '14px 18px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '14px 18px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* 2. Faculty Controls Bar: JNTU.No, Regulation, Courses with Generated Papers, Question Paper */}
      <div className="eval-controls-card">
        {/* Student JNTU.No */}
        <div className="form-group">
          <label className="form-label" htmlFor="jntuNo">
            JNTU.No / Roll No <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            id="jntuNo"
            type="text"
            className="form-control"
            placeholder="e.g. 20A91A0501"
            value={jntuNo}
            maxLength={10}
            onChange={(e) => {
              const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
              setJntuNo(clean);
              if (error && error.includes('JNTU')) {
                setError('');
              }
            }}
            required
            style={{ fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}
          />
          <div style={{
            fontSize: '0.82rem',
            color: isJntuEntered ? '#34d399' : 'var(--text-secondary, #94a3b8)',
            marginTop: '5px',
            fontWeight: 500
          }}>
            Enter JNTU number
          </div>
        </div>

        {/* Regulation */}
        <div className="form-group">
          <label className="form-label" htmlFor="regSelect">
            Regulation
          </label>
          <select
            id="regSelect"
            className="form-control"
            value={selectedRegulationId}
            onChange={handleRegulationChange}
          >
            <option value="">All Regulations</option>
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reg}
              </option>
            ))}
          </select>
        </div>

        {/* Courses with Generated Question Papers */}
        <div className="form-group">
          <label className="form-label" htmlFor="courseSelect">
            Course (Generated Papers) <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            id="courseSelect"
            className="form-control"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={coursesWithPapers.length === 0}
          >
            {coursesWithPapers.length === 0 ? (
              <option value="">No courses with generated papers found</option>
            ) : (
              coursesWithPapers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name} ({c.regulation_name || 'Reg'} • {c.papers_count} QP)
                </option>
              ))
            )}
          </select>
        </div>

        {/* Select Question Paper / Exam */}
        <div className="form-group">
          <label className="form-label" htmlFor="paperSelect">
            Question Paper Pattern <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            id="paperSelect"
            className="form-control"
            value={selectedPaperId}
            onChange={handlePaperChange}
            disabled={papersList.length === 0 || papersLoading}
          >
            {papersLoading ? (
              <option value="">Loading papers...</option>
            ) : papersList.length === 0 ? (
              <option value="">No question paper generated</option>
            ) : (
              papersList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.total_marks} Marks • Sem {p.sem})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* 3. The Double-Section Layout */}
      <div className="eval-double-section">
        {/* ================= LEFT SECTION: Empty Canvas / Student Answer Sheet ================= */}
        <div className="eval-sheet-section">
          <div className="eval-sheet-header">
            <div className="eval-sheet-title">
              <span>📋</span> Student Evaluation Sheet
            </div>
            {totalAttemptedCount > 0 && (
              <span className="q-badge-pill">
                {totalAttemptedCount} Question{totalAttemptedCount > 1 ? 's' : ''} Attempted
              </span>
            )}
          </div>

          {/* Student basic info strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            fontSize: '0.88rem',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Student ID: </span>
              <strong style={{ color: '#c4b5fd' }}>{jntuNo || '— Not Specified —'}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: 'var(--text-muted)' }}>Regulation: </span>
              <strong>{activePaper ? (regulations.find(r => String(r.id) === String(selectedRegulationId))?.reg || 'R23') : '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Course: </span>
              <strong>{activePaper?.course_code || '—'}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: 'var(--text-muted)' }}>Max Marks: </span>
              <strong>{maxTotalMarks} M</strong>
            </div>
          </div>

          {/* If NO questions attempted: Present the EMPTY SHEET canvas */}
          {totalAttemptedCount === 0 ? (
            <div className="empty-canvas-placeholder">
              <div className="empty-canvas-icon">📝</div>
              <div className="empty-canvas-text">Empty Answer Evaluation Canvas</div>
              <p className="empty-canvas-subtext">
                No questions have been evaluated yet. Click on any question in the Question Paper Pattern on the right to mark it as attempted and assign student marks.
              </p>
              <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '6px 12px',
                borderRadius: '6px'
              }}>
                <span>💡 Tip:</span>
                <span>Unattempted questions automatically register as 0 marks.</span>
              </div>
            </div>
          ) : (
            /* If questions ARE attempted: Show Live Scorecard & Evaluated Questions List */
            <>
              {/* Scorecard Banner */}
              <div className="scorecard-banner">
                <div className="scorecard-meta-row">
                  <span style={{ fontWeight: 700, color: '#fff' }}>Evaluation Score Summary</span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    background: percentage >= 50 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: percentage >= 50 ? '#34d399' : '#f87171'
                  }}>
                    {percentage >= 70 ? 'Distinction' : percentage >= 60 ? 'First Class' : percentage >= 40 ? 'Pass' : 'Needs Attention'}
                  </span>
                </div>

                <div className="scorecard-stats-grid">
                  <div className="scorecard-stat-box">
                    <div className="stat-box-val">{totalMarksObtained}</div>
                    <div className="stat-box-label">Marks Scored</div>
                  </div>
                  <div className="scorecard-stat-box">
                    <div className="stat-box-val">{maxTotalMarks}</div>
                    <div className="stat-box-label">Out Of</div>
                  </div>
                  <div className="scorecard-stat-box">
                    <div className="stat-box-val" style={{ color: '#38bdf8' }}>{percentage}%</div>
                    <div className="stat-box-label">Percentage</div>
                  </div>
                </div>

                <div className="score-progress-bar-wrap">
                  <div
                    className="score-progress-bar-fill"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Evaluated questions breakdown */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}>
                  <span>Evaluated Questions Breakdown</span>
                  <button
                    className="btn btn-secondary"
                    onClick={handleResetAllToNone}
                    style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                  >
                    Reset All
                  </button>
                </div>

                <div className="evaluated-questions-list">
                  {attemptedList.map((item) => (
                    <div key={item.q_id} className="evaluated-q-row">
                      <div className="evaluated-q-info">
                        <span className="q-badge-pill">{item.qLabel}</span>
                        <div style={{ fontSize: '0.84rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.sectionName}</span>
                          <span style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                            [Max: {item.maxMarks}M]
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="q-marks-pill">
                          {item.marksAwarded} M
                        </span>
                        <button
                          className="btn-none-remove"
                          title="Set question to None (0 marks)"
                          onClick={() => handleSetNone(item.q_id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks / Feedback */}
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label" htmlFor="evalRemarks">
                  Faculty Remarks / Notes (Optional)
                </label>
                <input
                  id="evalRemarks"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Good analytical reasoning, neat steps"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEvaluation}
                  disabled={saving || !isJntuEntered}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  title={!isJntuEntered ? 'Enter a valid 10-character JNTU number first' : 'Submit evaluation to database'}
                >
                  <span>{saving ? '⏳ Submitting...' : '✅ Submit Evaluation'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleResetAllToNone}
                  disabled={saving}
                >
                  Clear Sheet
                </button>
              </div>
            </>
          )}
        </div>

        {/* ================= RIGHT SECTION: Question Paper Pattern ================= */}
        <div className="eval-pattern-section">
          {!activePaper ? (
            <div className="pattern-sec-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📄</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                No Question Paper Pattern Loaded
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
                Please select a course and question paper from the top dropdown to view its pattern and start evaluating questions.
              </p>
            </div>
          ) : (
            <>
              {/* Pattern Header */}
              <div className="pattern-sec-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                      {activePaper.title}
                    </h3>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {activePaper.course_name} ({activePaper.course_code}) • {activePaper.total_marks} Total Marks
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="pattern-sec-badge">
                      {activePaper.pattern_sections?.length || 0} Sections
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleQuickFillMarks(1.0)}
                      style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                      disabled={!isJntuEntered}
                      title="Quickly fill full marks (100%) for all questions"
                    >
                      ⚡ Fill 100%
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleQuickFillMarks(0.75)}
                      style={{ fontSize: '0.78rem', padding: '5px 10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                      disabled={!isJntuEntered}
                      title="Quickly fill 75% marks across questions"
                    >
                      ⚡ Fill 75%
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleQuickFillMarks(0.5)}
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      disabled={!isJntuEntered}
                      title="Quickly fill passing marks (50%) across questions"
                    >
                      ⚡ Fill 50%
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleResetAllToNone}
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      disabled={!isJntuEntered}
                      title={!isJntuEntered ? 'Enter JNTU No. first' : 'Reset all questions'}
                    >
                      ↺ Set All None
                    </button>
                  </div>
                </div>
              </div>

              {/* Render each Section in the Question Paper */}
              {activePaper.pattern_sections?.map((sec, sIdx) => (
                <div key={sec.section_id || sIdx} className="pattern-sec-card">
                  <div className="pattern-sec-header">
                    <div className="pattern-sec-title">
                      <span>📌</span>
                      <span>{sec.section_name}</span>
                    </div>
                    <span className="pattern-sec-badge">
                      Max {sec.section_marks} Marks
                    </span>
                  </div>

                  <div className="pattern-questions-grid">
                    {sec.questions?.map((q) => {
                      if (q.is_choice && q.options) {
                        const opt1 = q.options[0];
                        const opt2 = q.options[1];
                        const summary = choiceSummaries[q.id] || { bestScore: 0, bestOptKey: null, optScores: {} };
                        const opt1Score = summary.optScores?.[opt1?.option_key] || 0;
                        const opt2Score = summary.optScores?.[opt2?.option_key] || 0;
                        const bestScore = summary.bestScore || 0;
                        const bestOptKey = summary.bestOptKey;

                        const opt1Subs = (opt1?.subquestions && opt1.subquestions.length > 0)
                          ? opt1.subquestions
                          : [{ sub_key: opt1?.option_key, sub_label: opt1?.q_label, max_marks: opt1?.marks, co: 'CO1' }];

                        const opt2Subs = (opt2?.subquestions && opt2.subquestions.length > 0)
                          ? opt2.subquestions
                          : [{ sub_key: opt2?.option_key, sub_label: opt2?.q_label, max_marks: opt2?.marks, co: 'CO2' }];

                        return (
                          <div key={q.id} className="choice-question-block">
                            <div className="choice-block-header">
                              <span>Internal Choice [Enter marks for either or both • Highest score counts]</span>
                              <span>Max {q.max_marks} Marks</span>
                            </div>

                            {/* Option 1 Card */}
                            <div className="q-pattern-item-card attempted" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                              <div className="q-item-meta" style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="q-no-display">{opt1.q_label}</span>
                                  <span className="q-max-marks-tag">Total [{opt1.marks}M]</span>
                                </div>
                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#38bdf8' }}>
                                  Scored: {opt1Score} / {opt1.marks}M
                                </span>
                              </div>

                              <div className="subquestions-wrapper">
                                {opt1Subs.map((sub) => {
                                  const state = evaluations[sub.sub_key] || { attempted: false, marksAwarded: 0 };
                                  return (
                                    <div
                                      key={sub.sub_key}
                                      className={`subquestion-row ${state.attempted ? 'attempted' : 'unattempted'}`}
                                    >
                                      <div className="subquestion-label-box">
                                        <span className="sub-label-text">{sub.sub_label}</span>
                                        {sub.co && <span className="co-pill">{sub.co}</span>}
                                        <span className="marks-max-tag">[{sub.max_marks}M]</span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                          type="button"
                                          className={`q-status-btn ${state.attempted ? 'attempted' : 'unattempted'}`}
                                          onClick={() => handleToggleQuestion(sub.sub_key)}
                                          disabled={!isJntuEntered}
                                          title={!isJntuEntered ? 'Enter JNTU No. first' : (state.attempted ? 'Click to mark as Not Attempted' : 'Click to mark as Attempted')}
                                        >
                                          {state.attempted ? 'Attempted ✓' : 'Not Attempted'}
                                        </button>

                                        <div className="marks-manual-wrapper">
                                          <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            max={sub.max_marks}
                                            value={state.marksAwarded === '' ? '' : state.marksAwarded}
                                            onChange={(e) => handleMarksInputChange(sub.sub_key, e.target.value, sub.max_marks)}
                                            className="marks-manual-input"
                                            placeholder="0"
                                            disabled={!isJntuEntered}
                                            title={`Enter marks (0 to ${sub.max_marks}M)`}
                                          />
                                          <span className="marks-max-tag">/ {sub.max_marks}M</span>

                                          {state.attempted && (
                                            <button
                                              type="button"
                                              className="btn-none-remove"
                                              title="Clear marks and mark unattempted"
                                              onClick={() => handleSetNone(sub.sub_key)}
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Choice OR Divider */}
                            <div className="choice-or-divider">
                              <span className="choice-or-badge">[ OR ]</span>
                            </div>

                            {/* Option 2 Card */}
                            <div className="q-pattern-item-card attempted" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                              <div className="q-item-meta" style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="q-no-display">{opt2.q_label}</span>
                                  <span className="q-max-marks-tag">Total [{opt2.marks}M]</span>
                                </div>
                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#38bdf8' }}>
                                  Scored: {opt2Score} / {opt2.marks}M
                                </span>
                              </div>

                              <div className="subquestions-wrapper">
                                {opt2Subs.map((sub) => {
                                  const state = evaluations[sub.sub_key] || { attempted: false, marksAwarded: 0 };
                                  return (
                                    <div
                                      key={sub.sub_key}
                                      className={`subquestion-row ${state.attempted ? 'attempted' : 'unattempted'}`}
                                    >
                                      <div className="subquestion-label-box">
                                        <span className="sub-label-text">{sub.sub_label}</span>
                                        {sub.co && <span className="co-pill">{sub.co}</span>}
                                        <span className="marks-max-tag">[{sub.max_marks}M]</span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                          type="button"
                                          className={`q-status-btn ${state.attempted ? 'attempted' : 'unattempted'}`}
                                          onClick={() => handleToggleQuestion(sub.sub_key)}
                                          disabled={!isJntuEntered}
                                          title={!isJntuEntered ? 'Enter JNTU No. first' : (state.attempted ? 'Click to mark as Not Attempted' : 'Click to mark as Attempted')}
                                        >
                                          {state.attempted ? 'Attempted ✓' : 'Not Attempted'}
                                        </button>

                                        <div className="marks-manual-wrapper">
                                          <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            max={sub.max_marks}
                                            value={state.marksAwarded === '' ? '' : state.marksAwarded}
                                            onChange={(e) => handleMarksInputChange(sub.sub_key, e.target.value, sub.max_marks)}
                                            className="marks-manual-input"
                                            placeholder="0"
                                            disabled={!isJntuEntered}
                                            title={`Enter marks (0 to ${sub.max_marks}M)`}
                                          />
                                          <span className="marks-max-tag">/ {sub.max_marks}M</span>

                                          {state.attempted && (
                                            <button
                                              type="button"
                                              className="btn-none-remove"
                                              title="Clear marks and mark unattempted"
                                              onClick={() => handleSetNone(sub.sub_key)}
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Choice Evaluation Summary / Winner Pill */}
                            <div className="choice-best-summary-banner">
                              <div className="choice-comparison-text">
                                {opt1.q_label}: <strong>{opt1Score} / {opt1.marks}M</strong> • {opt2.q_label}: <strong>{opt2Score} / {opt2.marks}M</strong>
                              </div>
                              <div className="choice-winner-pill">
                                ⭐ Best Counted: <strong>{bestScore} / {q.max_marks}M</strong>
                                {bestOptKey && (
                                  <span style={{ fontSize: '0.74rem', opacity: 0.9, marginLeft: '4px' }}>
                                    ({bestOptKey === opt1.option_key ? opt1.q_label : opt2.q_label})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Render Non-Choice Question (supports single or sub-questions a & b)
                        const subs = (q.subquestions && q.subquestions.length > 0)
                          ? q.subquestions
                          : [{ sub_key: q.id, sub_label: q.q_label, max_marks: q.max_marks, co: 'CO1' }];

                        const isMultiSub = subs.length > 1;

                        return (
                          <div
                            key={q.id}
                            className="q-pattern-item-card attempted"
                            style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}
                          >
                            {isMultiSub && (
                              <div className="q-item-meta" style={{ justifyContent: 'space-between', paddingBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="q-no-display">{q.q_label}</span>
                                  <span className="q-max-marks-tag">Total [{q.max_marks}M]</span>
                                </div>
                              </div>
                            )}

                            <div className="subquestions-wrapper">
                              {subs.map((sub) => {
                                const state = evaluations[sub.sub_key] || { attempted: false, marksAwarded: 0 };
                                return (
                                  <div
                                    key={sub.sub_key}
                                    className={`subquestion-row ${state.attempted ? 'attempted' : 'unattempted'}`}
                                  >
                                    <div className="subquestion-label-box">
                                      <span className="sub-label-text">{sub.sub_label}</span>
                                      {sub.co && <span className="co-pill">{sub.co}</span>}
                                      <span className="marks-max-tag">[{sub.max_marks}M]</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <button
                                        type="button"
                                        className={`q-status-btn ${state.attempted ? 'attempted' : 'unattempted'}`}
                                        onClick={() => handleToggleQuestion(sub.sub_key)}
                                        disabled={!isJntuEntered}
                                        title={!isJntuEntered ? 'Enter JNTU No. first' : (state.attempted ? 'Click to mark as Not Attempted' : 'Click to mark as Attempted')}
                                      >
                                        {state.attempted ? 'Attempted ✓' : 'Not Attempted'}
                                      </button>

                                      <div className="marks-manual-wrapper">
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          max={sub.max_marks}
                                          value={state.marksAwarded === '' ? '' : state.marksAwarded}
                                          onChange={(e) => handleMarksInputChange(sub.sub_key, e.target.value, sub.max_marks)}
                                          className="marks-manual-input"
                                          placeholder="0"
                                          disabled={!isJntuEntered}
                                          title={`Enter marks (0 to ${sub.max_marks}M)`}
                                        />
                                        <span className="marks-max-tag">/ {sub.max_marks}M</span>

                                        {state.attempted && (
                                          <button
                                            type="button"
                                            className="btn-none-remove"
                                            title="Clear marks and mark unattempted"
                                            onClick={() => handleSetNone(sub.sub_key)}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}

              {/* Submit Evaluation Card at the End of Evaluation Section */}
              <div className="eval-submit-card">
                <div className="eval-submit-info">
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                    Complete Student Marks Evaluation
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Student: <strong style={{ color: '#c4b5fd' }}>{jntuNo || '—'}</strong> • Attempted: <strong>{totalAttemptedCount} Questions</strong> • Total Marks: <strong style={{ color: '#34d399' }}>{totalMarksObtained} / {maxTotalMarks} M</strong> ({percentage}%)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary eval-submit-btn"
                    onClick={handleSaveEvaluation}
                    disabled={saving || !isJntuEntered}
                    title={!isJntuEntered ? 'Enter a valid 10-character JNTU number first' : 'Submit and save evaluation to database'}
                  >
                    <span>{saving ? '⏳ Submitting...' : '✅ Submit Evaluation'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Saved Students Table in Database */}
      {showSavedTable && (
        <div className="student-db-table-section">
          <div className="student-table-header">
            <div>
              <h2 className="student-table-title">
                <span>🗄️</span> Evaluated Students Records in Database
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                All student evaluation entries stored in the database. Click Edit to reload into the evaluator.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={tableCourseFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setTableCourseFilter(val);
                  fetchSavedStudents(val);
                }}
                style={{ width: '220px', fontSize: '0.84rem' }}
              >
                <option value="all">📚 All Courses (All Students)</option>
                {coursesWithPapers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="form-control"
                placeholder="Search by JNTU.No / Name..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ width: '220px', fontSize: '0.84rem' }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => fetchSavedStudents(tableCourseFilter)}
                title="Refresh Table"
                style={{ fontSize: '0.84rem', padding: '6px 12px' }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '36px 20px',
              color: 'var(--text-muted)',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)'
            }}>
              No student evaluation records found. Fill in student details and save above to store records.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>JNTU.No</th>
                    <th>Regulation</th>
                    <th>Course</th>
                    <th>Questions Attempted</th>
                    <th>Score / Max</th>
                    <th>Percentage</th>
                    <th>Evaluated By</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="jntu-badge">{s.jntu_no}</span>
                        {s.student_name && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {s.student_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.82rem'
                        }}>
                          {s.regulation || 'R23'}
                        </span>
                      </td>
                      <td>
                        <div><strong>{s.course_code}</strong></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.course_name}</div>
                      </td>
                      <td>
                        <span className="q-badge-pill" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                          {s.attempted_count} Attempted
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#fff', fontSize: '1rem' }}>{s.total_marks_obtained}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}> / {s.max_total_marks}M</span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 800,
                          color: s.percentage >= 60 ? '#34d399' : s.percentage >= 40 ? '#38bdf8' : '#f87171'
                        }}>
                          {s.percentage}%
                        </span>
                      </td>
                      <td style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                        {s.faculty_name || 'Faculty'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {s.created_at ? s.created_at.split(' ')[0] : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleLoadStudent(s)}
                            style={{ padding: '4px 10px', fontSize: '0.82rem' }}
                            title="Edit / Re-evaluate"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => setDeleteId(s.id)}
                            style={{ padding: '4px 10px', fontSize: '0.82rem' }}
                            title="Delete Record"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Delete */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Student Evaluation"
        message="Are you sure you want to permanently delete this student evaluation record from the database?"
        onConfirm={handleDeleteStudent}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
        danger
      />
    </div>
  );
};

export default StudentEvaluation;
