import api from './api';

export const mappingService = {
  getAll: () => api.get('/mappings'),
  getById: (id) => api.get(`/mappings/${id}`),
  create: (data) => api.post('/mappings', data),
  update: (id, data) => api.put(`/mappings/${id}`, data),
  delete: (id) => api.delete(`/mappings/${id}`)
};
