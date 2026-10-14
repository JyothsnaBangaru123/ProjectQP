import api from './api';

export const pbmappingService = {
  getAll: () => api.get('/pbmappings'),
  getById: (id) => api.get(`/pbmappings/${id}`),
  create: (data) => api.post('/pbmappings', data),
  update: (id, data) => api.put(`/pbmappings/${id}`, data),
  delete: (id) => api.delete(`/pbmappings/${id}`)
};
