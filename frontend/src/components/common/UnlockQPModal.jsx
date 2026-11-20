import React, { useState } from 'react';
import Modal from './Modal';
import { qpService } from '../../services/qpService';

const UnlockQPModal = ({ isOpen, onClose, paper, onUnlocked }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !paper) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Please enter the question paper password.');
      return;
    }

    setVerifying(true);
    try {
      const res = await qpService.verifyPassword(paper.id, password.trim());
      if (res.success) {
        setPassword('');
        setError('');
        onUnlocked(paper);
      } else {
        setError(res.message || 'Incorrect password.');
      }
    } catch (err) {
      setError(err.message || 'Incorrect password. Please verify the password received in your email.');
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="🔒 Enter Password to View & Print"
      size="md"
    >
      <form onSubmit={handleUnlock}>
        <div style={{
          background: 'rgba(2, 132, 199, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px'
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {paper.title}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            📘 {paper.course_name} ({paper.course_code}) • {paper.total_marks} MARKS
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan, #38bdf8)', marginTop: '8px' }}>
            ℹ️ This question paper is protected with AES-256 encryption. Enter the authorization password received via your registered email to unlock viewing and printing.
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            marginBottom: '16px',
            fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Password <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              placeholder="Enter question paper password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={verifying}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-primary)',
                fontSize: '0.92rem'
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
                color: 'var(--text-secondary)'
              }}
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={verifying}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={verifying || !password.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {verifying ? (
              <>
                <span>⏳</span>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>🔓</span>
                <span>Unlock &amp; View Paper</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UnlockQPModal;

