import api from './api';

export const documentService = {
  getAll: (params = {}) => api.get('/documents', { params }),
  getByCourse: (courseId) => api.get(`/documents/course/${courseId}`),
  getById: (id) => api.get(`/documents/${id}`),
  upload: (formData) => api.post('/documents/upload', formData),
  extractText: (formData) => api.post('/documents/extract', formData),
  delete: (id) => api.delete(`/documents/${id}`),
  getDownloadUrl: (id) => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
    return `${baseURL}/documents/download/${id}`;
  }
};
