import api from './api';

export const bloomService = {
  getAll: () => api.get('/blooms'),
  getById: (id) => api.get(`/blooms/${id}`),
  create: (data) => api.post('/blooms', data),
  update: (id, data) => api.put(`/blooms/${id}`, data),
  delete: (id) => api.delete(`/blooms/${id}`)
};
