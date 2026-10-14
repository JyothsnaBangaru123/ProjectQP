import React from 'react';

const SelectInput = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  required = false,
  disabled = false,
  ...props
}) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span style={{ color: 'var(--status-inactive)' }}>*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        className={`form-control ${error ? 'is-invalid' : ''}`}
        required={required}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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

export default SelectInput;
