import api from './api';

export const qpService = {
  generate: (payload) => api.post('/qp/generate', payload),
  extractCOs: (payload) => api.post('/qp/extract-cos', payload),
  save: (payload) => api.post('/qp/save', payload),
  getAll: (params = {}) => api.get('/qp', { params }),
  getById: (id) => api.get(`/qp/${id}`),
  delete: (id) => api.delete(`/qp/${id}`)
};
