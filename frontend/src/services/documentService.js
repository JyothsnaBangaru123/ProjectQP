import api from './api';

export const documentService = {
  getAll: (params = {}) => api.get('/documents', { params }),
  getByCourse: (courseId) => api.get(`/documents/course/${courseId}`),
  getById: (id) => api.get(`/documents/${id}`),
  upload: (formData) => api.post('/documents/upload', formData),
  extractText: (formData) => api.post('/documents/extract', formData),
  delete: (id) => api.delete(`/documents/${id}`),
  downloadDocument: async (id, fileName) => {
    const response = await api.get(`/documents/download/${id}`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `document_${id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  getDownloadUrl: (id) => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
    const token = localStorage.getItem('token');
    return `${baseURL}/documents/download/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
};
