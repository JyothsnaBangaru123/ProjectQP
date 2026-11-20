import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { regulationService } from '../../services/regulationService';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import './COEvaluation.css';

const COEvaluation = () => {
  const { user, isFaculty } = useAuth();

  // Filters & Data Sources
  const [regulations, setRegulations] = useState([]);
  const [coursesWithPapers, setCoursesWithPapers] = useState([]);
  const [papersList, setPapersList] = useState([]);

  const [selectedRegulationId, setSelectedRegulationId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState('');

  // Evaluation Results Data
  const [coData, setCoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [qaSectionFilter, setQaSectionFilter] = useState('all');
  const [qaCoFilter, setQaCoFilter] = useState('all');
  const [qaSearch, setQaSearch] = useState('');

  // Blueprint inspection modal
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [selectedCOForBlueprint, setSelectedCOForBlueprint] = useState(null);

  // 1. Initial Load: Fetch Regulations and Courses with Generated Papers
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError('');
      try {
        const [regRes, coursesRes] = await Promise.all([
          regulationService.getAll(),
          studentService.getCoursesWithPapers()
        ]);

        if (regRes.success) {
          setRegulations(regRes.data || []);
        }
        if (coursesRes.success && coursesRes.data && coursesRes.data.length > 0) {
          setCoursesWithPapers(coursesRes.data);
          const first = coursesRes.data[0];
          setSelectedCourseId(String(first.id));
          if (first.reg_id) {
            setSelectedRegulationId(String(first.reg_id));
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize CO Evaluation portal.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // 2. When Regulation changes, filter courses
  const handleRegulationChange = async (e) => {
    const regId = e.target.value;
    setSelectedRegulationId(regId);
    setSelectedCourseId('');
    setSelectedPaperId('');
    setCoData(null);

    try {
      const res = await studentService.getCoursesWithPapers(regId ? { regulation_id: regId } : {});
      if (res.success && res.data) {
        setCoursesWithPapers(res.data);
        if (res.data.length > 0) {
          setSelectedCourseId(String(res.data[0].id));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to filter courses by regulation.');
    }
  };

  // 3. When Course changes, load papers
  useEffect(() => {
    if (!selectedCourseId) {
      setPapersList([]);
      setSelectedPaperId('');
      setCoData(null);
      return;
    }

    const loadPapers = async () => {
      try {
        const res = await studentService.getPapersByCourse(selectedCourseId);
        if (res.success && res.data && res.data.length > 0) {
          setPapersList(res.data);
          setSelectedPaperId(String(res.data[0].id));
        } else {
          setPapersList([]);
          setSelectedPaperId('');
          setCoData(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to load question papers for course.');
      }
    };

    loadPapers();
  }, [selectedCourseId]);

  // 4. Fetch CO Evaluation metrics whenever course or paper changes
  useEffect(() => {
    if (!selectedCourseId && !selectedPaperId) return;

    const fetchCOMetrics = async () => {
      setEvalLoading(true);
      setError('');
      try {
        const params = {};
        if (selectedPaperId) params.question_paper_id = selectedPaperId;
        if (selectedCourseId) params.course_id = selectedCourseId;
        if (selectedRegulationId) params.regulation_id = selectedRegulationId;

        const res = await studentService.getCOEvaluation(params);
        if (res.success && res.data) {
          setCoData(res.data);
        } else {
          setCoData(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to compute CO attainment metrics.');
        setCoData(null);
      } finally {
        setEvalLoading(false);
      }
    };

    fetchCOMetrics();
  }, [selectedPaperId, selectedCourseId, selectedRegulationId]);

  // Filter student matrix by search query
  const filteredStudents = useMemo(() => {
    if (!coData?.student_matrix) return [];
    if (!searchQuery.trim()) return coData.student_matrix;

    const q = searchQuery.trim().toLowerCase();
    return coData.student_matrix.filter(
      (s) =>
        s.jntu_no?.toLowerCase().includes(q) ||
        s.student_name?.toLowerCase().includes(q)
    );
  }, [coData, searchQuery]);

  // Question Analytics filtering & summary metrics
  const questionAnalytics = coData?.question_analytics || [];

  const sectionOptions = useMemo(() => {
    const set = new Set();
    questionAnalytics.forEach((q) => {
      if (q.section_name) set.add(q.section_name);
    });
    return Array.from(set);
  }, [questionAnalytics]);

  const filteredQuestionAnalytics = useMemo(() => {
    return questionAnalytics.filter((q) => {
      if (qaSectionFilter !== 'all' && q.section_name !== qaSectionFilter) {
        return false;
      }
      if (qaCoFilter !== 'all' && q.co !== qaCoFilter) {
        return false;
      }
      if (qaSearch) {
        const term = qaSearch.toLowerCase();
        const matchesLabel = q.q_label?.toLowerCase().includes(term);
        const matchesSection = q.section_name?.toLowerCase().includes(term);
        const matchesCO = q.co?.toLowerCase().includes(term);
        if (!matchesLabel && !matchesSection && !matchesCO) {
          return false;
        }
      }
      return true;
    });
  }, [questionAnalytics, qaSectionFilter, qaCoFilter, qaSearch]);

  const qaStats = useMemo(() => {
    if (!questionAnalytics.length) return null;
    const totalQ = questionAnalytics.length;
    const avgAttempt = Math.round(
      questionAnalytics.reduce((acc, q) => acc + (q.attempt_percentage || 0), 0) / (totalQ || 1)
    );
    const avgScore = Math.round(
      questionAnalytics.reduce((acc, q) => acc + (q.avg_score_percentage || 0), 0) / (totalQ || 1)
    );
    const attemptedOnly = questionAnalytics.filter((q) => q.students_attempted > 0);
    const sortedByAttempt = [...questionAnalytics].sort((a, b) => b.attempt_percentage - a.attempt_percentage);
    const sortedByScore = [...attemptedOnly].sort((a, b) => b.avg_score_percentage - a.avg_score_percentage);

    return {
      totalQ,
      avgAttempt,
      avgScore,
      mostAttempted: sortedByAttempt[0],
      topScorer: sortedByScore[0]
    };
  }, [questionAnalytics]);

  // Helper for progress bar color
  const getProgressBarColor = (percentage) => {
    if (percentage >= 70) return '#10b981'; // Emerald
    if (percentage >= 60) return '#06b6d4'; // Cyan
    if (percentage >= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Rose
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <Loader message="Initializing Course Outcome Evaluation Engine..." />;
  }

  return (
    <div className="co-eval-container">
      {/* 1. Header */}
      <div className="co-eval-header">
        <div className="co-eval-title-wrap">
          <div className="co-eval-title">
            <span>🎯</span> Course Outcome (CO) Evaluation & Attainment
          </div>
          <div className="co-eval-subtitle">
            OBE & NBA/NAAC Attainment Matrix • Automatic sub-question mapping & student performance analytics
          </div>
        </div>

        <div className="co-eval-actions">
          <button
            className="btn btn-secondary no-print"
            onClick={handlePrint}
            title="Print or export attainment report"
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ margin: 0 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 2. Filter Bar */}
      <div className="co-filter-card no-print">
        {/* Regulation */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="regFilter">
            Regulation
          </label>
          <select
            id="regFilter"
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

        {/* Course */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="courseFilter">
            Course <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            id="courseFilter"
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

        {/* Question Paper */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="qpFilter">
            Question Paper Exam <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            id="qpFilter"
            className="form-control"
            value={selectedPaperId}
            onChange={(e) => setSelectedPaperId(e.target.value)}
            disabled={papersList.length === 0}
          >
            {papersList.length === 0 ? (
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

      {evalLoading ? (
        <Loader message="Calculating Course Outcome attainment scores from student evaluations..." />
      ) : !coData || !coData.cos || coData.cos.length === 0 ? (
        <div className="co-empty-state">
          <div className="co-empty-icon">📊</div>
          <div className="co-empty-title">No Evaluation Data Found</div>
          <p className="co-empty-subtext">
            No student evaluations have been recorded yet for the selected question paper.
            {isFaculty ? (
              <> Please go to <strong>Student Marks Entry</strong> to evaluate student answer sheets first.</>
            ) : (
              <> Faculty instructors have not yet entered student marks for this examination paper.</>
            )}
          </p>
        </div>
      ) : (
        <>
          {/* 3. Hero Stats Banner */}
          <div className="co-hero-banner">
            <div className="co-hero-info">
              <div className="co-hero-paper-title">
                {coData.question_paper?.title || 'Selected Examination Paper'}
              </div>
              <div className="co-hero-meta">
                <span>📘 <strong>{coData.question_paper?.course_name}</strong> ({coData.question_paper?.course_code})</span>
                <span>•</span>
                <span>📜 Regulation: <strong>{coData.question_paper?.regulation || 'R23'}</strong></span>
                <span>•</span>
                <span>🎯 Total Marks: <strong>{coData.question_paper?.total_marks}M</strong></span>
              </div>
            </div>

            <div className="co-hero-stat-box">
              <div className="co-stat-big-val" style={{ color: '#c4b5fd' }}>
                {coData.total_students_evaluated || 0}
              </div>
              <div className="co-stat-sub-label">Students Evaluated</div>
            </div>

            <div className="co-hero-stat-box">
              <div className="co-stat-big-val" style={{ color: '#34d399' }}>
                {coData.overall_attainment_score || '0.00'}
              </div>
              <div className="co-stat-sub-label">Direct Attainment / 3.0</div>
            </div>

            <div className="co-hero-stat-box">
              <div
                className="co-stat-big-val"
                style={{
                  color: (coData.overall_attainment_score >= 2.0)
                    ? '#34d399'
                    : (coData.overall_attainment_score >= 1.5)
                    ? '#38bdf8'
                    : '#fbbf24'
                }}
              >
                {coData.overall_attainment_score >= 2.1
                  ? 'Level 3'
                  : coData.overall_attainment_score >= 1.8
                  ? 'Level 2'
                  : coData.overall_attainment_score >= 1.5
                  ? 'Level 1'
                  : 'Level 0'}
              </div>
              <div className="co-stat-sub-label">Overall Level</div>
            </div>
          </div>

          {/* 4. Six Course Outcomes (CO1 to CO6) Summary Cards */}
          <div>
            <div className="section-head-row" style={{ marginBottom: '14px' }}>
              <div className="section-head-title">
                <span>📋</span> Course Outcomes Breakdown (CO1 - CO6)
              </div>
              <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                Benchmark Threshold: <strong>≥ 50% Marks</strong> to achieve target
              </span>
            </div>

            <div className="co-cards-grid">
              {coData.cos.map((co) => {
                const levelClass = `co-level-${co.attainment_level}`;
                const barColor = getProgressBarColor(co.attainment_percentage);

                return (
                  <div key={co.co_id} className="co-card">
                    <div className="co-card-header">
                      <div className="co-badge-title">
                        <span>🎯</span> {co.co_id}
                      </div>
                      <span className={`co-level-badge ${levelClass}`}>
                        {co.attainment_level_label}
                      </span>
                    </div>

                    {/* Mapped Questions Strip */}
                    <div className="co-mapped-questions-strip">
                      <span>Questions ({co.question_count}):</span>
                      {co.mapped_questions && co.mapped_questions.length > 0 ? (
                        co.mapped_questions.map((qLbl, i) => (
                          <span key={i} className="q-tag-chip">
                            {qLbl}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontStyle: 'italic', opacity: 0.7 }}>None</span>
                      )}
                    </div>

                    {/* Metrics List */}
                    <div className="co-metrics-list">
                      <div className="co-metric-row">
                        <span className="co-metric-label">Student Attempt Rate:</span>
                        <span className="co-metric-value" style={{ color: '#38bdf8' }}>
                          {co.attempt_percentage}% ({co.students_attempted} / {co.total_students})
                        </span>
                      </div>

                      <div className="co-metric-row">
                        <span className="co-metric-label">Class Average Score:</span>
                        <span className="co-metric-value">
                          {co.avg_score_percentage}%
                        </span>
                      </div>

                      <div className="co-metric-row">
                        <span className="co-metric-label">Students Met Target (≥50%):</span>
                        <span className="co-metric-value" style={{ color: '#34d399' }}>
                          {co.students_attained} ({co.attainment_percentage}%)
                        </span>
                      </div>

                      <div className="co-metric-row" style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <span className="co-metric-label" style={{ fontWeight: 700, color: '#fff' }}>Direct Attainment Score:</span>
                        <span className="co-metric-value" style={{ fontSize: '1.05rem', color: barColor }}>
                          {co.attainment_score} / 3.00
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Question-Wise Attempt Rate & Performance Analytics */}
          <div className="co-matrix-section">
            <div className="section-head-row">
              <div className="section-head-title">
                <span>📝</span> Question-Wise Attempt Rate & Performance Analytics ({filteredQuestionAnalytics.length} Questions)
              </div>

              {/* Filters & Search */}
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  style={{ width: '150px', padding: '6px 10px', fontSize: '0.85rem' }}
                  value={qaSectionFilter}
                  onChange={(e) => setQaSectionFilter(e.target.value)}
                  title="Filter by Section"
                >
                  <option value="all">All Sections</option>
                  {sectionOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  className="form-control"
                  style={{ width: '130px', padding: '6px 10px', fontSize: '0.85rem' }}
                  value={qaCoFilter}
                  onChange={(e) => setQaCoFilter(e.target.value)}
                  title="Filter by Outcome"
                >
                  <option value="all">All COs</option>
                  {['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="form-control"
                  style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
                  placeholder="🔍 Search question..."
                  value={qaSearch}
                  onChange={(e) => setQaSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Summary Pill Bar */}
            {qaStats && (
              <div className="qa-stats-strip">
                <div className="qa-stat-pill">
                  <span className="qa-stat-pill-label">Total Questions in Pattern:</span>
                  <span className="qa-stat-pill-val">{qaStats.totalQ}</span>
                </div>
                <div className="qa-stat-pill">
                  <span className="qa-stat-pill-label">Avg Question Attempt Rate:</span>
                  <span className="qa-stat-pill-val" style={{ color: '#38bdf8' }}>{qaStats.avgAttempt}%</span>
                </div>
                <div className="qa-stat-pill">
                  <span className="qa-stat-pill-label">Avg Question Score Rate:</span>
                  <span className="qa-stat-pill-val" style={{ color: '#34d399' }}>{qaStats.avgScore}%</span>
                </div>
                {qaStats.mostAttempted && (
                  <div className="qa-stat-pill">
                    <span className="qa-stat-pill-label">Most Attempted:</span>
                    <span className="qa-stat-pill-val" style={{ color: '#c4b5fd' }}>
                      {qaStats.mostAttempted.q_label} ({qaStats.mostAttempted.attempt_percentage}%)
                    </span>
                  </div>
                )}
                {qaStats.topScorer && (
                  <div className="qa-stat-pill">
                    <span className="qa-stat-pill-label">Highest Score:</span>
                    <span className="qa-stat-pill-val" style={{ color: '#10b981' }}>
                      {qaStats.topScorer.q_label} ({qaStats.topScorer.avg_score_percentage}%)
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="co-table-responsive">
              <table className="co-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Section</th>
                    <th className="text-center">Mapped CO</th>
                    <th className="text-center">Max Marks</th>
                    <th className="text-center">Students Attempted</th>
                    <th className="text-center" style={{ minWidth: '150px' }}>Attempt Rate (%)</th>
                    <th className="text-center">Avg Marks Scored</th>
                    <th className="text-center" style={{ minWidth: '150px' }}>Avg Score (%)</th>
                    <th className="text-center">Performance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestionAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                        No question pattern analytics found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredQuestionAnalytics.map((q, idx) => {
                      const isChoice = q.is_choice;
                      const isOr = q.is_or_choice;
                      const perfColor =
                        q.performance_badge === 'green'
                          ? '#34d399'
                          : q.performance_badge === 'blue'
                          ? '#38bdf8'
                          : q.performance_badge === 'amber'
                          ? '#fbbf24'
                          : '#94a3b8';
                      const perfBg =
                        q.performance_badge === 'green'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : q.performance_badge === 'blue'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : q.performance_badge === 'amber'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(255, 255, 255, 0.06)';

                      return (
                        <tr key={q.q_id || idx} style={isOr ? { background: 'rgba(139, 92, 246, 0.03)' } : {}}>
                          <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                color: '#f8fafc',
                                letterSpacing: '0.3px'
                              }}>
                                {q.q_label}
                              </span>
                              {isChoice && isOr && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(139, 92, 246, 0.2)',
                                  color: '#c4b5fd',
                                  border: '1px solid rgba(139, 92, 246, 0.4)'
                                }}>
                                  OR Choice
                                </span>
                              )}
                              {isChoice && !isOr && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8'
                                }}>
                                  Main Choice
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ color: '#cbd5e1', fontSize: '0.84rem' }}>{q.section_name}</span>
                          </td>
                          <td className="text-center">
                            <span style={{
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)'
                            }}>
                              {q.co}
                            </span>
                          </td>
                          <td className="text-center" style={{ fontWeight: 600 }}>
                            {q.max_marks} M
                          </td>
                          <td className="text-center">
                            <strong>{q.students_attempted}</strong> / {q.total_students}
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                                <span style={{ color: '#38bdf8' }}>{q.attempt_percentage}%</span>
                              </div>
                              <div className="co-progress-wrap" style={{ height: '5px', margin: 0 }}>
                                <div
                                  className="co-progress-fill"
                                  style={{
                                    width: `${Math.min(100, q.attempt_percentage)}%`,
                                    background: '#38bdf8'
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <strong>{q.avg_marks}</strong> M
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                                <span style={{ color: perfColor }}>{q.avg_score_percentage}%</span>
                              </div>
                              <div className="co-progress-wrap" style={{ height: '5px', margin: 0 }}>
                                <div
                                  className="co-progress-fill"
                                  style={{
                                    width: `${Math.min(100, q.avg_score_percentage)}%`,
                                    background: perfColor
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: perfBg,
                              color: perfColor,
                              border: `1px solid ${perfColor}40`
                            }}>
                              {q.performance_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Comprehensive CO Attainment Matrix Table */}
          <div className="co-matrix-section">
            <div className="section-head-row">
              <div className="section-head-title">
                <span>📊</span> CO Attainment Comparison Table
              </div>
            </div>

            <div className="co-table-responsive">
              <table className="co-data-table">
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th>Mapped Questions</th>
                    <th className="text-center">Questions Count</th>
                    <th className="text-center">Total Students</th>
                    <th className="text-center">Attempted</th>
                    <th className="text-center">Attempt %</th>
                    <th className="text-center">Avg Score %</th>
                    <th className="text-center">Met Target (≥50%)</th>
                    <th className="text-center">Attainment %</th>
                    <th className="text-center">Attainment Level</th>
                    <th className="text-center">Attainment Score (/3.0)</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coData.cos.map((co) => {
                    const levelClass = `co-level-${co.attainment_level}`;
                    return (
                      <tr key={co.co_id}>
                        <td>
                          <strong style={{ color: '#38bdf8', fontSize: '0.98rem' }}>{co.co_id}</strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {co.mapped_questions?.map((qLbl, i) => (
                              <span key={i} className="q-tag-chip">
                                {qLbl}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-center"><strong>{co.question_count}</strong></td>
                        <td className="text-center">{co.total_students}</td>
                        <td className="text-center">{co.students_attempted}</td>
                        <td className="text-center">
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                            {co.attempt_percentage}%
                          </span>
                        </td>
                        <td className="text-center">{co.avg_score_percentage}%</td>
                        <td className="text-center">{co.students_attained}</td>
                        <td className="text-center">
                          <strong style={{ color: getProgressBarColor(co.attainment_percentage) }}>
                            {co.attainment_percentage}%
                          </strong>
                        </td>
                        <td className="text-center">
                          <span className={`co-level-badge ${levelClass}`}>
                            {co.attainment_level_label}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="co-score-cell" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                            {co.attainment_score}
                          </span>
                        </td>
                        <td className="text-center">
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            background: co.status === 'Attained' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: co.status === 'Attained' ? '#34d399' : '#f87171'
                          }}>
                            {co.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Student-by-Student CO Performance Drilldown Table */}
          <div className="co-matrix-section">
            <div className="section-head-row">
              <div className="section-head-title">
                <span>🎓</span> Student-by-Student CO Performance Matrix ({filteredStudents.length} Students)
              </div>

              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '260px', padding: '6px 12px', fontSize: '0.85rem' }}
                  placeholder="🔍 Search Roll No or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="co-table-responsive">
              <table className="co-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Roll / JNTU No.</th>
                    <th>Student Name</th>
                    <th className="text-center">CO1 (%)</th>
                    <th className="text-center">CO2 (%)</th>
                    <th className="text-center">CO3 (%)</th>
                    <th className="text-center">CO4 (%)</th>
                    <th className="text-center">CO5 (%)</th>
                    <th className="text-center">CO6 (%)</th>
                    <th className="text-center">Total Marks</th>
                    <th className="text-center">Overall %</th>
                    <th className="text-center">COs Attained (≥50%)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                        No student evaluation records matched your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => (
                      <tr key={st.id || idx}>
                        <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                        <td>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#c4b5fd'
                          }}>
                            {st.jntu_no}
                          </span>
                        </td>
                        <td>{st.student_name}</td>

                        {/* CO1 to CO6 columns */}
                        {['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'].map((coKey) => {
                          const cScore = st.co_scores?.[coKey];
                          if (!cScore || !cScore.attempted) {
                            return (
                              <td key={coKey} className="text-center" style={{ color: '#64748b' }}>
                                —
                              </td>
                            );
                          }
                          const isAttained = cScore.percentage >= 50.0;
                          return (
                            <td key={coKey} className="text-center">
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                background: isAttained ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isAttained ? '#34d399' : '#f87171'
                              }} title={`Scored ${cScore.scored} / ${cScore.max}M`}>
                                {cScore.percentage}%
                              </span>
                            </td>
                          );
                        })}

                        <td className="text-center">
                          <strong>{st.total_marks_obtained}</strong> / {st.max_total_marks}M
                        </td>
                        <td className="text-center">
                          <strong style={{ color: st.percentage >= 50 ? '#34d399' : '#f87171' }}>
                            {st.percentage}%
                          </strong>
                        </td>
                        <td className="text-center">
                          <span style={{
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8'
                          }}>
                            {st.attained_co_count} / 6
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default COEvaluation;
