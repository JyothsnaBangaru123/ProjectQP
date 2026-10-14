import React from 'react';

const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  min,
  max,
  ...props
}) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span style={{ color: 'var(--status-inactive)' }}>*</span>}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={`form-control ${error ? 'is-invalid' : ''}`}
        required={required}
        {...props}
      />
      {error && (
        <span style={{ 
          display: 'block', 
          color: 'var(--status-inactive)', 
          fontSize: '0.8rem', 
          marginTop: '6px',
          fontWeight: 500
        }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default FormInput;
