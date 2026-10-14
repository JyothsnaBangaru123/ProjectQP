import api from './api';

export const bcmappingService = {
  getAll: () => api.get('/bcmappings'),
  getById: (id) => api.get(`/bcmappings/${id}`),
  create: (data) => api.post('/bcmappings', data),
  update: (id, data) => api.put(`/bcmappings/${id}`, data),
  delete: (id) => api.delete(`/bcmappings/${id}`)
};
