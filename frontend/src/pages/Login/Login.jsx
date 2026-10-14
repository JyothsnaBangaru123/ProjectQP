import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FormInput from '../../components/common/FormInput';
import { validateRequired, validatePassword } from '../../utils/validators';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    
    // Front-end validations
    const usernameErr = validateRequired(username, 'Username');
    const passwordErr = validatePassword(password);

    if (usernameErr || passwordErr) {
      setErrors({
        username: usernameErr,
        password: passwordErr
      });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const res = await login(username, password);
      const roleName = (res.data?.role || res.data?.type || '').toLowerCase();
      
      if (roleName.includes('faculty') || roleName.includes('teacher') || roleName.includes('professor')) {
        navigate('/faculty', { replace: true });
      } else if (roleName.includes('hod') || roleName.includes('head')) {
        navigate('/hod', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setServerError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1 className="auth-title">QP Management</h1>
        <p className="auth-subtitle">Sign in to access your role portal (Faculty / HOD / Admin)</p>
      </div>

      {serverError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--status-inactive)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.9rem',
          marginBottom: '20px',
          fontWeight: 500,
          textAlign: 'center'
        }}>
          ⚠️ {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormInput
          label="Username / Email / Personnel No"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. admin or employee ID / email"
          error={errors.username}
          required
          disabled={submitting}
        />

        <FormInput
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          error={errors.password}
          required
          disabled={submitting}
        />

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '10px' }}
          disabled={submitting}
        >
          {submitting ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default Login;
