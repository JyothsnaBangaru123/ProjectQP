import React from 'react';

const Loader = ({ message = 'Loading details...' }) => {
  return (
    <div className="spinner-container">
      <div className="spinner"></div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{message}</p>
    </div>
  );
};

export default Loader;
