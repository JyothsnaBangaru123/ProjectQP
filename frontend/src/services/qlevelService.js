import api from './api';

export const qlevelService = {
  getAll: () => api.get('/qlevel'),
  getById: (id) => api.get(`/qlevel/${id}`),
  create: (data) => api.post('/qlevel', data),
  update: (id, data) => api.put(`/qlevel/${id}`, data),
  delete: (id) => api.delete(`/qlevel/${id}`)
};
