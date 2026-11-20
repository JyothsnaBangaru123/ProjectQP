import api from './api';

export const qpService = {
  generate: (payload) => api.post('/qp/generate', payload),
  extractCOs: (payload) => api.post('/qp/extract-cos', payload),
  extractUnits: (payload) => api.post('/qp/extract-units', payload),
  save: (payload) => api.post('/qp/save', payload),
  getAll: (params = {}) => api.get('/qp', { params }),
  getById: (id) => api.get(`/qp/${id}`),
  delete: (id) => api.delete(`/qp/${id}`),

  // Security & Encryption features
  getAvailableFaculty: () => api.get('/faculty/available'),
  protectAndShare: (id, payload) => api.post(`/question-papers/${id}/protect-and-share`, payload),
  getSharingDetails: (id) => api.get(`/question-papers/${id}/sharing-details`),
  shareWithAdditionalFaculty: (id, payload) => api.post(`/question-papers/${id}/share-with-additional-faculty`, payload),
  verifyPassword: (id, password) => api.post(`/question-papers/${id}/verify-password`, { password }),
  downloadProtectedPDF: async (id, fileName) => {
    const rawData = await api.get(`/question-papers/${id}/download-protected`, {
      responseType: 'blob'
    });
    // In api.js interceptor, response.data is already returned
    // So rawData is already the Blob (or ArrayBuffer)
    const blob = rawData instanceof Blob 
      ? rawData 
      : new Blob([rawData], { type: 'application/pdf' });

    // Validate that it's not a small JSON error payload
    if (blob.type === 'application/json' || blob.size < 500) {
      try {
        const text = await blob.text();
        const json = JSON.parse(text);
        if (json.success === false) {
          throw new Error(json.message || 'Failed to download question paper.');
        }
      } catch (err) {
        if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = (fileName || `Question_Paper_${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};
