import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token) {
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {}
        }
        try {
          const res = await authService.getCurrentUser();
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (err) {
          console.error('Session validation failed', err);
          // If token invalid, clear
          if (!savedUser) {
            localStorage.removeItem('token');
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await authService.login({ user_name: username, password });
      if (res.success && res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
        return res;
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Backend logout call failed', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const roleName = (user?.role || user?.type || '').toLowerCase();
  const isFaculty = roleName.includes('faculty') || roleName.includes('teacher') || roleName.includes('professor');
  const isHOD = roleName.includes('hod') || roleName.includes('head') || roleName.includes('department head');
  const isAdmin = roleName.includes('admin') || !user || (!isFaculty && !isHOD);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    role: user?.role || user?.type || 'User',
    isFaculty,
    isHOD,
    isAdmin,
    branchId: user?.branch_id,
    branchName: user?.branch_name
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
