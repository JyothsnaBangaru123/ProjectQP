import React, { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, size = 'md', maxWidth, style }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: '420px' },
    md: { maxWidth: '580px' },
    lg: { maxWidth: '850px', width: '92vw' },
    xl: { maxWidth: '1150px', width: '94vw' },
    full: { maxWidth: '96vw', width: '96vw', height: '94vh' }
  };

  const modalStyle = {
    ...(sizeStyles[size] || {}),
    ...(maxWidth ? { maxWidth, width: '94vw' } : {}),
    ...(style || {})
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
