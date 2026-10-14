import React from 'react';
import Modal from './Modal';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Deletion', 
  message = 'Are you sure you want to delete this record? This action cannot be undone.' 
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="confirm-dialog">
        <p className="confirm-text">{message}</p>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px', 
          marginTop: '24px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px'
        }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Confirm Delete
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
