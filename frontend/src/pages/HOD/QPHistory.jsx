import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { qpService } from '../../services/qpService';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ProtectQPModal from '../../components/common/ProtectQPModal';
import QPSharingDetailsModal from '../../components/common/QPSharingDetailsModal';
import UnlockQPModal from '../../components/common/UnlockQPModal';
import AcademicQuestionPaper from '../../components/common/AcademicQuestionPaper';

const QPHistory = () => {
  const navigate = useNavigate();
  const { isHOD, isFaculty } = useAuth();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // View Paper Modal
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Security & Protection Modals
  const [protectingPaper, setProtectingPaper] = useState(null);
  const [sharingDetailsPaper, setSharingDetailsPaper] = useState(null);
  const [unlockingPaper, setUnlockingPaper] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleViewAndPrint = (paper) => {
    if (paper.is_password_protected) {
      setUnlockingPaper(paper);
    } else {
      setSelectedPaper(paper);
    }
  };

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
      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 5000);
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

  const handleDownloadProtected = async (paper) => {
    setDownloadingId(paper.id);
    try {
      await qpService.downloadProtectedPDF(paper.id, paper.title);
      showNotification(`Downloaded encrypted PDF for "${paper.title}". Use the password sent to your email to open it.`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '';
      if (msg.includes('404') || msg.includes('not found') || msg.includes('before persistent')) {
        showNotification(`This file was created before cloud storage was activated. Please click "🔒 Re-protect" below to set a password and regenerate the file permanently.`, 'error');
      } else {
        showNotification(msg || 'Failed to download encrypted question paper.', 'error');
      }
    } finally {
      setDownloadingId(null);
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
            {isHOD
              ? 'Browse, review, password-protect, and selectively distribute examination question papers.'
              : 'Browse authorized question papers and securely download encrypted examination PDFs.'}
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
          color: 'var(--status-active, #10b981)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius, 8px)',
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
          color: 'var(--status-inactive, #ef4444)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius, 8px)',
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
              : 'Archived examination question papers will appear here once generated.'}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {papers.map((paper) => {
            const isProtected = !!paper.is_password_protected;
            const canDownload = paper.can_download !== false;
            const isFacultyRestricted = isFaculty && isProtected && !paper.can_download;

            return (
              <div
                key={paper.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isProtected ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Status Badges Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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

                      {isProtected ? (
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🔒 AES-256 Protected
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: 'rgba(148, 163, 184, 0.15)',
                          color: '#94a3b8',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          🔓 Standard (Unencrypted)
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {paper.created_at ? paper.created_at.split(' ')[0] : ''}
                    </span>
                  </div>

                  {/* Title & Course Info */}
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
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Generated by: <strong style={{ color: 'var(--text-primary)' }}>{paper.hod_name}</strong>
                    </div>
                  )}

                  {/* Security Timestamp & Details */}
                  {isProtected && paper.protected_at && (
                    <div style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.45)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                      marginTop: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <div>
                        🔒 Protected: <strong>{new Date(paper.protected_at).toLocaleString()}</strong>
                      </div>
                      {isHOD && paper.shared_count !== undefined && (
                        <div style={{ marginTop: '2px', color: '#38bdf8' }}>
                          👥 Shared with <strong>{paper.shared_count}</strong> faculty member(s)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Role Specific Notice Banners */}
                  {isFaculty && isProtected && (
                    <div style={{ marginTop: '10px' }}>
                      {paper.can_download ? (
                        <div style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: '#10b981',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 500
                        }}>
                          ✓ Authorized — Password delivered to your email
                        </div>
                      ) : (
                        <div style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 500
                        }}>
                          🔒 Access Restricted — HOD has not shared the password with you
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Section */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '16px',
                  borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  paddingTop: '12px'
                }}>
                  {/* Primary Row */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* HOD Actions */}
                    {isHOD && (
                      <>
                        {!isProtected ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              padding: '7px 10px',
                              fontSize: '0.85rem',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              borderColor: '#10b981'
                            }}
                            onClick={() => setProtectingPaper(paper)}
                          >
                            🔒 Protect PDF with Password
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                              onClick={() => setSharingDetailsPaper(paper)}
                            >
                              ⚙️ Sharing Details
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                              disabled={downloadingId === paper.id}
                              onClick={() => handleDownloadProtected(paper)}
                            >
                              {downloadingId === paper.id ? 'Downloading...' : '⬇️ Download PDF'}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                          onClick={() => handleViewAndPrint(paper)}
                          title={isProtected ? "Enter password to view and print" : "View and print paper"}
                        >
                          👁️ View &amp; Print
                        </button>

                        {isProtected && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '7px 8px', fontSize: '0.8rem', color: '#38bdf8' }}
                            onClick={() => setProtectingPaper(paper)}
                            title="Re-encrypt question paper or reset password"
                          >
                            🔒 Re-protect
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                          onClick={() => setDeleteId(paper.id)}
                          title="Delete from archive"
                        >
                          🗑️
                        </button>
                      </>
                    )}

                    {/* Faculty Actions */}
                    {isFaculty && (
                      <>
                        {isProtected ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: '0.88rem',
                                opacity: isFacultyRestricted ? 0.5 : 1,
                                cursor: isFacultyRestricted ? 'not-allowed' : 'pointer'
                              }}
                              disabled={isFacultyRestricted || downloadingId === paper.id}
                              onClick={() => !isFacultyRestricted && handleDownloadProtected(paper)}
                              title={isFacultyRestricted ? 'Access restricted: Contact HOD for authorization' : 'Download AES-256 encrypted PDF'}
                            >
                              {downloadingId === paper.id
                                ? 'Downloading Encrypted PDF...'
                                : isFacultyRestricted
                                ? '🔒 Access Restricted by HOD'
                                : '⬇️ Download PDF'}
                            </button>
                            {!isFacultyRestricted && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                                onClick={() => handleViewAndPrint(paper)}
                                title="Enter password to view and print"
                              >
                                👁️ View &amp; Print
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
                            onClick={() => handleViewAndPrint(paper)}
                          >
                            👁️ View &amp; Print
                          </button>
                        )}
                      </>
                    )}

                    {/* Admin Actions */}
                    {!isHOD && !isFaculty && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
                          onClick={() => handleViewAndPrint(paper)}
                        >
                          👁️ View &amp; Print
                        </button>
                        {isProtected && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
                            disabled={downloadingId === paper.id}
                            onClick={() => handleDownloadProtected(paper)}
                          >
                            {downloadingId === paper.id ? 'Downloading...' : '⬇️ Download PDF'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Paper Modal (Standard Unencrypted View) */}
      <Modal
        isOpen={selectedPaper !== null}
        onClose={() => setSelectedPaper(null)}
        title={selectedPaper ? selectedPaper.title : 'Examination Paper'}
        size="xl"
      >
        {selectedPaper && (
          <div>
            {selectedPaper.is_password_protected && (
              <div className="no-print" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🔒</span>
                <div>
                  <strong>HOD Author Review Mode:</strong> This paper is password-protected with AES-256 for distribution.
                  Faculty members cannot view the questions directly in their browser; they can only download the encrypted PDF file and must enter the emailed password in their PDF reader.
                </div>
              </div>
            )}

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={handlePrintModal}>
                🖨️ Print / Export PDF
              </button>
            </div>

            {/* Paper Sheet Preview */}
            <div id="printable-question-paper" className="academic-qp-sheet" style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxHeight: '78vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              padding: '12px'
            }}>
              <AcademicQuestionPaper paper={selectedPaper} editable={false} />
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPaper(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* HOD Protect QP Modal */}
      {protectingPaper && (
        <ProtectQPModal
          isOpen={protectingPaper !== null}
          onClose={() => setProtectingPaper(null)}
          paper={protectingPaper}
          paperId={protectingPaper.id}
          paperTitle={protectingPaper.title}
          onSuccess={() => {
            fetchPapers();
            showNotification(`Question paper "${protectingPaper.title}" successfully protected with password and distributed!`);
          }}
        />
      )}

      {/* HOD Sharing Details & Additional Recipients Modal */}
      {sharingDetailsPaper && (
        <QPSharingDetailsModal
          isOpen={sharingDetailsPaper !== null}
          onClose={() => setSharingDetailsPaper(null)}
          paperId={sharingDetailsPaper.id}
          paperTitle={sharingDetailsPaper.title}
          onUpdated={() => {
            fetchPapers();
          }}
        />
      )}

      {/* Password Unlock Modal for View & Print */}
      {unlockingPaper && (
        <UnlockQPModal
          isOpen={unlockingPaper !== null}
          onClose={() => setUnlockingPaper(null)}
          paper={unlockingPaper}
          onUnlocked={(unlockedPaper) => {
            setUnlockingPaper(null);
            setSelectedPaper(unlockedPaper);
          }}
        />
      )}

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
