import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Loader from './Loader';
import { qpService } from '../../services/qpService';

const QPSharingDetailsModal = ({ isOpen, onClose, paperId, paperTitle, onUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Additional Sharing State
  const [availableFaculty, setAvailableFaculty] = useState([]);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);
  const [reenteredPassword, setReenteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    if (!paperId) return;
    setLoading(true);
    setError('');
    try {
      const [detailsRes, facultyRes] = await Promise.all([
        qpService.getSharingDetails(paperId),
        qpService.getAvailableFaculty()
      ]);

      if (detailsRes.success) {
        setDetails(detailsRes.data);
      } else {
        setError(detailsRes.message || 'Failed to load sharing details.');
      }

      if (facultyRes.success) {
        setAvailableFaculty(facultyRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve sharing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && paperId) {
      setDetails(null);
      setSelectedFacultyIds([]);
      setReenteredPassword('');
      setSuccessMsg('');
      setError('');
      loadData();
    }
  }, [isOpen, paperId]);

  if (!isOpen) return null;

  // Filter out faculty members who have already been shared with
  const alreadySharedIds = new Set((details?.recipients || []).map(r => r.faculty_user_id));
  const unsharedFaculty = availableFaculty.filter(f => !alreadySharedIds.has(f.id));
  const filteredUnshared = unsharedFaculty.filter(f =>
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFaculty = (id) => {
    setSelectedFacultyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedFacultyIds.length === filteredUnshared.length) {
      setSelectedFacultyIds([]);
    } else {
      setSelectedFacultyIds(filteredUnshared.map(f => f.id));
    }
  };

  const handleShareAdditional = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (selectedFacultyIds.length === 0) {
      setError('Please select at least one faculty member to share with.');
      return;
    }

    if (!reenteredPassword) {
      setError('Please enter the question paper password to authorize distribution.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await qpService.shareWithAdditionalFaculty(paperId, {
        faculty_ids: selectedFacultyIds,
        password: reenteredPassword
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Password successfully sent to additional faculty members!');
        setReenteredPassword('');
        setSelectedFacultyIds([]);
        // Reload details
        const detailsRes = await qpService.getSharingDetails(paperId);
        if (detailsRes.success) {
          setDetails(detailsRes.data);
        }
        if (onUpdated) onUpdated();
      } else {
        setError(res.message || 'Failed to share with additional faculty.');
      }
    } catch (err) {
      setError(err.message || 'Distribution error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Question Paper Security & Sharing Details"
      size="lg"
    >
      <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
        {loading ? (
          <Loader message="Loading security & recipient records..." />
        ) : (
          <div>
            {/* Header Summary */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px 0', color: '#f8fafc' }}>
                    {details?.title || paperTitle}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 500 }}>
                    📘 {details?.course_name} ({details?.course_code})
                  </div>
                </div>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🔒 AES-256 Protected
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Protected On:</span>{' '}
                  <strong>{details?.protected_at ? new Date(details.protected_at).toLocaleString() : 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Protected By:</span>{' '}
                  <strong>{details?.protected_by_name || 'HOD'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Authorized Recipients:</span>{' '}
                  <strong style={{ color: '#38bdf8' }}>{details?.recipients?.length || 0} Faculty</strong>
                </div>
              </div>
            </div>

            {/* Notifications */}
            {successMsg && (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '16px',
                fontWeight: 500
              }}>
                ✓ {successMsg}
              </div>
            )}

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '16px',
                fontWeight: 500
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Existing Recipients Table */}
            <div style={{ marginBottom: '28px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '10px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> Authorized Faculty Recipients
              </h4>

              {(!details?.recipients || details.recipients.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', color: '#94a3b8', fontSize: '0.88rem' }}>
                  No faculty members have been granted access yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Faculty Name</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Registered Email</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Shared Date</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8' }}>Email Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.recipients.map((r, idx) => (
                        <tr key={r.id || idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#f8fafc' }}>
                            {r.recipient_name}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                            {r.recipient_email}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                            {r.shared_at ? new Date(r.shared_at).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: r.email_status === 'sent' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: r.email_status === 'sent' ? '#34d399' : '#f87171',
                              border: `1px solid ${r.email_status === 'sent' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                            }}>
                              {r.email_status === 'sent' ? '✓ Delivered' : '✗ Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Share with Additional Faculty Section */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '18px 20px'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>➕</span> Share Password with Additional Faculty
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
                Select additional faculty members who should receive access. Re-enter the existing question paper password to verify authorization and dispatch emails.
              </p>

              {unsharedFaculty.length === 0 ? (
                <div style={{ fontSize: '0.88rem', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
                  All registered faculty members have already been granted access to this question paper.
                </div>
              ) : (
                <form onSubmit={handleShareAdditional}>
                  {/* Password Re-entry */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '6px' }}>
                      Question Paper Password <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={reenteredPassword}
                        onChange={(e) => setReenteredPassword(e.target.value)}
                        placeholder="Enter the password protecting this PDF"
                        disabled={submitting}
                        style={{
                          width: '100%',
                          padding: '9px 40px 9px 12px',
                          background: 'rgba(30, 41, 59, 0.7)',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.9rem'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          color: '#94a3b8'
                        }}
                      >
                        {showPassword ? '👁️' : '🔒'}
                      </button>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                      The backend verifies this password directly against the encrypted PDF before sending emails.
                    </span>
                  </div>

                  {/* Search and Selection Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search unshared faculty..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        minWidth: '220px'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                        {selectedFacultyIds.length} of {filteredUnshared.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#818cf8',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0
                        }}
                      >
                        {selectedFacultyIds.length === filteredUnshared.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* Faculty Selection List */}
                  <div style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '6px',
                    marginBottom: '16px'
                  }}>
                    {filteredUnshared.length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                        No matching faculty found.
                      </div>
                    ) : (
                      filteredUnshared.map(faculty => {
                        const isChecked = selectedFacultyIds.includes(faculty.id);
                        return (
                          <label
                            key={faculty.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              borderBottom: '1px solid rgba(148, 163, 184, 0.06)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFaculty(faculty.id)}
                              disabled={submitting}
                              style={{ marginRight: '10px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                                {faculty.name}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {faculty.email} {faculty.department ? `• ${faculty.department}` : ''}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || selectedFacultyIds.length === 0 || !reenteredPassword}
                      style={{ fontSize: '0.88rem', padding: '8px 16px' }}
                    >
                      {submitting ? 'Verifying & Sending...' : `Send Password to ${selectedFacultyIds.length} Faculty`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.15)', marginTop: '20px', paddingTop: '14px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default QPSharingDetailsModal;

