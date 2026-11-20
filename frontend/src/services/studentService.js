import api from './api';

export const studentService = {
  getAll: (params = {}) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  save: (payload) => api.post('/students', payload),
  update: (id, payload) => api.put(`/students/${id}`, payload),
  delete: (id) => api.delete(`/students/${id}`),
  getCoursesWithPapers: (params = {}) => api.get('/students/courses-with-papers', { params }),
  getPapersByCourse: (courseId) => api.get(`/students/papers-by-course/${courseId}`),
  getCOEvaluation: (params = {}) => api.get('/students/co-evaluation', { params })
};
