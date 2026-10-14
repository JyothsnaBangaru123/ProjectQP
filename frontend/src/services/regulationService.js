import api from './api';

export const regulationService = {
  getAll: () => api.get('/regulations'),
  getById: (id) => api.get(`/regulations/${id}`),
  create: (data) => api.post('/regulations', data),
  update: (id, data) => api.put(`/regulations/${id}`, data),
  delete: (id) => api.delete(`/regulations/${id}`)
};
