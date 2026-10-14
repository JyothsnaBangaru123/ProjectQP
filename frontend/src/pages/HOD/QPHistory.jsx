import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { qpService } from '../../services/qpService';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const QPHistory = () => {
  const navigate = useNavigate();
  const { isHOD } = useAuth();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // View Paper Modal
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const res = await qpService.getAll();
      if (res.success) {
        setPapers(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load question paper archives.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const showNotification = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await qpService.delete(deleteId);
      if (res.success) {
        showNotification('Question paper removed from archives successfully');
        fetchPapers();
      }
    } catch (err) {
      showNotification(err.message || 'Delete failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const handlePrintModal = () => {
    if (selectedPaper) {
      const originalTitle = document.title;
      const cleanCourse = (selectedPaper.course_code || 'QP').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanTitle = (selectedPaper.title || 'Examination').replace(/[^a-zA-Z0-9_-]/g, '_');
      document.title = `${cleanCourse}_${cleanTitle}_Question_Paper`;
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } else {
      window.print();
    }
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.55rem', fontWeight: 700 }}>
            {isHOD ? 'Department Question Paper Archives' : 'Question Paper Archives'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Browse, review, and print finalized examination question papers.
          </p>
        </div>
        {isHOD && (
          <button className="btn btn-primary" onClick={() => navigate('/hod/generate')}>
            ⚡ Generate New Paper
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--status-active)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--status-inactive)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <Loader message="Loading archived question papers..." />
      ) : papers.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>🗄️</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            No Question Papers Archived Yet
          </div>
          <p style={{ fontSize: '0.92rem', marginTop: '6px' }}>
            {isHOD 
              ? 'Generate your first examination paper from uploaded course documents.' 
              : 'Archived examination question papers generated across departments will appear here.'}
          </p>
          {isHOD && (
            <button
              onClick={() => navigate('/hod/generate')}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              ⚡ Launch Question Paper Generator
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {papers.map((paper) => (
            <div key={paper.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--accent-purple, #8b5cf6)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {paper.total_marks} MARKS
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {paper.created_at ? paper.created_at.split(' ')[0] : ''}
                  </span>
                </div>

                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  {paper.title}
                </h4>

                <div style={{ fontSize: '0.92rem', color: 'var(--accent-cyan, #06b6d4)', fontWeight: 600, marginBottom: '8px' }}>
                  📘 {paper.course_name} ({paper.course_code})
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  AY: {paper.academic_year} • Semester: {paper.sem} • Duration: {paper.duration}
                </div>

                {paper.hod_name && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Generated by: <strong style={{ color: 'var(--text-primary)' }}>{paper.hod_name}</strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
                  onClick={() => setSelectedPaper(paper)}
                >
                  👁️ View & Print
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                  onClick={() => setDeleteId(paper.id)}
                  title="Delete from archive"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Paper Modal */}
      <Modal
        isOpen={selectedPaper !== null}
        onClose={() => setSelectedPaper(null)}
        title={selectedPaper ? selectedPaper.title : 'Examination Paper'}
      >
        {selectedPaper && (
          <div>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={handlePrintModal}>
                🖨️ Print / Export PDF
              </button>
            </div>

            {/* Paper Sheet Preview */}
            <div className="printable-paper-sheet" style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              padding: '28px 32px',
              borderRadius: '6px',
              maxHeight: '440px',
              overflowY: 'auto'
            }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 2px 0', color: '#0f172a' }}>
                  {selectedPaper.generated_content?.institution_name || 'GMR Institute of Technology'}
                </h3>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155' }}>
                  {selectedPaper.generated_content?.department_name || selectedPaper.branch_name || 'Department of Engineering'}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '6px', color: '#1e293b' }}>
                  {selectedPaper.title} - AY {selectedPaper.academic_year}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85rem', marginBottom: '18px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                <div><strong>Course: </strong>{selectedPaper.course_name} ({selectedPaper.course_code})</div>
                <div style={{ textAlign: 'right' }}><strong>Semester: </strong>{selectedPaper.sem}</div>
                <div><strong>Duration: </strong>{selectedPaper.duration}</div>
                <div style={{ textAlign: 'right' }}><strong>Max. Marks: </strong>{selectedPaper.total_marks}</div>
              </div>

              {selectedPaper.generated_content?.sections?.map((sec, sIdx) => (
                <div key={sIdx} style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    backgroundColor: '#f1f5f9',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginBottom: '8px',
                    color: '#1e293b'
                  }}>
                    <span>{sec.section_name}</span>
                    <span>[{sec.section_marks} Marks]</span>
                  </div>

                  {sec.questions?.map((q, qIdx) => {
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
                          gap: '4px',
                          padding: '6px 0 10px 0',
                          borderBottom: '1px dashed #cbd5e1'
                        }}>
                          <div className="printable-question-row" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 140px', gap: '8px', alignItems: 'start', fontSize: '0.88rem' }}>
                            <div style={{ fontWeight: 700 }}>
                              <span>Q{cleanQ1 || 'A'}.</span>
                            </div>
                            <div style={{ whiteSpace: 'pre-line' }}>{part1}</div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                              [{q.marks}M] • {q.bloom_level}
                            </div>
                          </div>

                          <div className="printable-or-divider" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '4px 0',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              left: '70px',
                              right: '140px',
                              top: '50%',
                              borderTop: '1px dashed #cbd5e1',
                              zIndex: 0
                            }} />
                            <span style={{
                              position: 'relative',
                              zIndex: 1,
                              backgroundColor: '#ffffff',
                              padding: '0 14px',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              color: '#475569',
                              letterSpacing: '2px'
                            }}>
                              [ OR ]
                            </span>
                          </div>

                          <div className="printable-question-row" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 140px', gap: '8px', alignItems: 'start', fontSize: '0.88rem' }}>
                            <div style={{ fontWeight: 700 }}>
                              <span>Q{cleanQ2 || 'B'}.</span>
                            </div>
                            <div style={{ whiteSpace: 'pre-line' }}>{part2}</div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                              [{q.marks}M] • {q.bloom_level}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={qIdx} className="printable-question-row" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 140px', gap: '8px', padding: '6px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '0.88rem' }}>
                        <div style={{ fontWeight: 700 }}>
                          <span>Q{cleanSingle}.</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-line' }}>{q.question}</div>
                        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                          [{q.marks}M] • {q.bloom_level}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPaper(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this question paper from department archives?"
      />
    </div>
  );
};

export default QPHistory;
