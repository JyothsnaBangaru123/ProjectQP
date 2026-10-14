import React from 'react';
import SelectInput from './SelectInput';

const StatusSelect = ({ label = 'Status', name = 'status', value, onChange, error, required = false }) => {
  const options = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' }
  ];

  // Force cast value to number so select works correctly
  const parsedValue = value !== undefined && value !== null ? Number(value) : '';

  return (
    <SelectInput
      label={label}
      name={name}
      value={parsedValue}
      onChange={onChange}
      options={options}
      placeholder="Select status"
      error={error}
      required={required}
    />
  );
};

export default StatusSelect;
