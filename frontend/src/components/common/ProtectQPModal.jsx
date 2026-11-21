import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Loader from './Loader';
import { qpService } from '../../services/qpService';

const ProtectQPModal = ({
  isOpen,
  onClose,
  paper,
  paperId,
  paperTitle,
  onSuccess,
  onProtectedSuccess
}) => {
  const [step, setStep] = useState('form'); // 'form' or 'result'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Faculty selection state
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState(new Set());
  const [searchFaculty, setSearchFaculty] = useState('');
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [resultData, setResultData] = useState(null);

  // Derive normalized paper properties safely from either `paper` prop or fallback props
  const effectivePaper = paper || {};
  const effectivePaperId = effectivePaper.id || paperId;
  const effectiveTitle = effectivePaper.title || paperTitle || 'Finalized Question Paper';
  const effectiveCourseName = effectivePaper.course_name || '';
  const effectiveCourseCode = effectivePaper.course_code || '';
  const effectiveMarks = effectivePaper.total_marks;

  // Load faculty list when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setValidationError('');
      setResultData(null);
      setSelectedFacultyIds(new Set());
      setSearchFaculty('');

      const fetchFaculty = async () => {
        setLoadingFaculty(true);
        try {
          const res = await qpService.getAvailableFaculty();
          if (res.success && res.data) {
            setFacultyList(res.data);
          }
        } catch (err) {
          setValidationError(err.message || 'Failed to load faculty directory.');
        } finally {
          setLoadingFaculty(false);
        }
      };

      fetchFaculty();
    }
  }, [isOpen, effectivePaperId]);

  // Filtered faculty list based on search
  const filteredFaculty = useMemo(() => {
    if (!searchFaculty.trim()) return facultyList;
    const q = searchFaculty.toLowerCase();
    return facultyList.filter(
      (f) =>
        (f.name || f.user_name)?.toLowerCase().includes(q) ||
        f.email?.toLowerCase().includes(q) ||
        (f.department || f.branch_name)?.toLowerCase().includes(q)
    );
  }, [facultyList, searchFaculty]);

  const handleToggleFaculty = (id) => {
    setSelectedFacultyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredFaculty.map((f) => f.id));
    setSelectedFacultyIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedFacultyIds(new Set());
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setValidationError('');

    if (!effectivePaperId) {
      setValidationError('Question paper ID is missing. Please save the question paper first before encrypting.');
      return;
    }

    // Client-side validations
    const cleanPw = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPw || !cleanConfirm) {
      setValidationError('Both password fields are mandatory.');
      return;
    }

    if (cleanPw !== cleanConfirm) {
      setValidationError('Passwords do not match. Please re-check.');
      return;
    }

    if (cleanPw.length < 12) {
      setValidationError('Password must be at least 12 characters long for strong AES-256 encryption.');
      return;
    }

    if (cleanPw.length > 40) {
      setValidationError('Password cannot exceed 40 characters for standard PDF encryption.');
      return;
    }

    if (selectedFacultyIds.size === 0) {
      setValidationError('Please select at least one registered faculty member to receive access.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        password: cleanPw,
        confirm_password: cleanConfirm,
        faculty_ids: Array.from(selectedFacultyIds)
      };

      const res = await qpService.protectAndShare(effectivePaperId, payload);
      if (res.success) {
        setResultData(res.data);
        setStep('result');
        if (onProtectedSuccess) {
          onProtectedSuccess(res.data);
        }
        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        setValidationError(res.message || 'Encryption and password sharing failed.');
      }
    } catch (err) {
      setValidationError(err.message || 'An error occurred during encryption and sharing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={!submitting ? onClose : () => {}}
      title="🔒 Protect Question Paper with Password"
      size="lg"
    >
      <div style={{ padding: '4px' }}>
        {step === 'form' ? (
          <div>
            {/* Header info */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(30, 41, 59, 0.5) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {effectiveTitle}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {effectiveCourseName && (
                  <span>
                    Course: <strong style={{ color: 'var(--text-primary)' }}>{effectiveCourseName}</strong>
                    {effectiveCourseCode ? ` (${effectiveCourseCode})` : ''}
                  </span>
                )}
                {effectiveCourseName && effectiveMarks ? <span>•</span> : null}
                {effectiveMarks ? (
                  <span>
                    Max Marks: <strong style={{ color: 'var(--accent-purple, #8b5cf6)' }}>{effectiveMarks} MARKS</strong>
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--accent-cyan, #38bdf8)', marginTop: '8px' }}>
                ℹ️ The backend will encrypt this question paper using AES-256. The password will be delivered via email ONLY to the faculty members you select below.
              </div>
            </div>

            {validationError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.9rem',
                marginBottom: '16px',
                fontWeight: 500
              }}>
                ⚠️ {validationError}
              </div>
            )}

            {/* SECTION 1: Password Fields */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1. Set PDF Protection Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-cyan, #38bdf8)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  {showPassword ? '👁️ Hide Passwords' : '👁️ Show Passwords'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter password (min 12 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-color, #334155)',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem'
                    }}
                    disabled={submitting}
                  />
                  <div style={{ fontSize: '0.78rem', color: password.length >= 12 ? 'var(--status-active, #10b981)' : 'var(--text-secondary)', marginTop: '4px' }}>
                    {password.length}/12 characters minimum
                  </div>
                </div>

                <div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-color, #334155)',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem'
                    }}
                    disabled={submitting}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '4px' }}>
                      Passwords do not match
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: Faculty Selection Interface */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  2. Select Authorized Faculty Recipients <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent-cyan, #38bdf8)', marginLeft: '10px' }}>
                    ({selectedFacultyIds.size} of {facultyList.length} selected)
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    onClick={handleSelectAll}
                    disabled={submitting || facultyList.length === 0}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    onClick={handleDeselectAll}
                    disabled={submitting || selectedFacultyIds.size === 0}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Search box */}
              <input
                type="text"
                placeholder="🔍 Search faculty by name, email, or department..."
                value={searchFaculty}
                onChange={(e) => setSearchFaculty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  marginBottom: '10px'
                }}
                disabled={submitting}
              />

              {/* Faculty checklist */}
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                padding: '8px'
              }}>
                {loadingFaculty ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading faculty directory...
                  </div>
                ) : filteredFaculty.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No faculty members found.
                  </div>
                ) : (
                  filteredFaculty.map((f) => {
                    const isChecked = selectedFacultyIds.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => !submitting && handleToggleFaculty(f.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          marginBottom: '4px',
                          cursor: submitting ? 'default' : 'pointer',
                          backgroundColor: isChecked ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                          border: isChecked ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div onClick
                          disabled={submitting}
                          style={{ marginRight: '12px', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isChecked ? '#38bdf8' : 'var(--text-primary)' }}>
                            {f.name || f.user_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            ✉️ {f.email} {(f.department || f.branch_name) ? `• ${f.department || f.branch_name}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SECTION 3: Confirmation Summary */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Summary:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <li>PDF will be encrypted using <strong>AES-256</strong> with the provided password.</li>
                <li>Password will be sent individually to <strong>{selectedFacultyIds.size}</strong> faculty member(s).</li>
                <li>Faculty not selected will not receive the password and cannot access the paper.</li>
              </ul>
            </div>

            {/* Modal Footer Controls */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || selectedFacultyIds.size === 0 || password.length < 12}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {submitting ? (
                  <>
                    <span>⏳</span>
                    <span>Encrypting &amp; Sharing...</span>
                  </>
                ) : (
                  <>
                    <span>🔒</span>
                    <span>Confirm &amp; Protect PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* RESULT SCREEN */
          <div>
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>✓</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', margin: '0 0 6px 0' }}>
                Question Paper Successfully Protected
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                The PDF has been encrypted with AES-256. The password was emailed to authorized faculty recipients.
              </p>
            </div>

            {/* Delivery Status Table */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                Email Delivery Report:
              </div>
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Faculty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultData?.recipients?.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.faculty_name || r.recipient_name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.email || r.recipient_email}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {r.status === 'sent' ? (
                            <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Sent</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 700 }} title={r.error || 'Failed'}>
                              ⚠️ Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {resultData?.failed_deliveries > 0 && (
              <div style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '6px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                lineHeight: 1.4
              }}>
                <strong>⚠️ Notice:</strong> {resultData.recipients?.find(r => r.error)?.error || 'Email dispatch failed. Please verify email credentials or webhook.'}
              </div>
            )}

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProtectQPModal;
