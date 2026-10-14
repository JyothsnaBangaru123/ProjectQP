import api from './api';

export const loginUserService = {
  getAll: () => api.get('/login-users'),
  getById: (id) => api.get(`/login-users/${id}`),
  create: (data) => api.post('/login-users', data),
  update: (id, data) => api.put(`/login-users/${id}`, data),
  delete: (id) => api.delete(`/login-users/${id}`)
};
