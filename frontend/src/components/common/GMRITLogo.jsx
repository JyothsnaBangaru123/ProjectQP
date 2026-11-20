import React from 'react';
import gmritLogoImg from '../../assets/gmrit_logo.png';

/**
 * GMRIT Official Logo Component
 * Uses the exact authentic university header logo extracted from the institution document.
 */
export const GMRITLogo = ({ height = 65, className = '' }) => {
  return (
    <div className={`gmrit-logo-container ${className}`} style={{ textAlign: 'center', margin: '0 auto 6px auto' }}>
      <img
        src={gmritLogoImg}
        alt="GMRIT Deemed to be University"
        style={{
          height: `${height}px`,
          maxHeight: '75px',
          width: 'auto',
          display: 'block',
          margin: '0 auto',
          objectFit: 'contain'
        }}
        onError={(e) => {
          e.target.src = '/gmrit_logo.png';
        }}
      />
    </div>
  );
};

export default GMRITLogo;
