export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Invalid email address';
  return null;
};

export const validateRequired = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${fieldName || 'Field'} is required`;
  }
  return null;
};

export const validateInteger = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${fieldName || 'Field'} is required`;
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return `${fieldName || 'Field'} must be an integer`;
  }
  if (num < 0) {
    return `${fieldName || 'Field'} must be a positive integer`;
  }
  return null;
};

export const validatePhone = (value) => {
  if (!value) return null; // Phone is optional
  const re = /^\d{10}$/;
  if (!re.test(String(value))) {
    return 'Contact must be a 10-digit number';
  }
  return null;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 5) {
    return 'Password must be at least 5 characters long';
  }
  return null;
};
