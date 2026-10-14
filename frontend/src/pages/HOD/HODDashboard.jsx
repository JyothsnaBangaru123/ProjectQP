import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { documentService } from '../../services/documentService';
import { courseService } from '../../services/courseService';
import { userService } from '../../services/userService';
import { qpService } from '../../services/qpService';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';

const HODDashboard = () => {
  const { user, branchName, branchId } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [generatedQPs, setGeneratedQPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsRes, coursesRes, usersRes, qpRes] = await Promise.all([
        documentService.getAll(),
        courseService.getAll(),
        userService.getAll(),
        qpService.getAll()
      ]);

      if (docsRes.success) setDocuments(docsRes.data);
      if (coursesRes.success) setCourses(coursesRes.data);
      if (usersRes.success) setFacultyUsers(usersRes.data);
      if (qpRes.success) setGeneratedQPs(qpRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load department dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPreview = async (doc) => {
    try {
      const res = await documentService.getById(doc.id);
      if (res.success) {
        setPreviewDoc(res.data);
      }
    } catch (err) {
      setPreviewDoc(doc);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocs = selectedCourseFilter === 'all'
    ? documents
    : documents.filter(d => String(d.course_id) === String(selectedCourseFilter));

  return (
    <div>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(99, 102, 241, 0.15))',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        borderRadius: 'var(--border-radius, 8px)',
        padding: '24px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              {branchName ? `${branchName} Department` : 'Department Dashboard'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              Welcome HOD {user?.user_name || ''}. Review course materials uploaded by your department faculty and generate question papers.
            </p>
          </div>
          <div>
            <button
              onClick={() => navigate('/hod/generate')}
              className="btn btn-primary"
              style={{
                fontSize: '1rem',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              <span>⚡</span>
              <span>Generate Question Paper</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--status-inactive)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="stats-grid" style={{ marginBottom: '28px' }}>
        <div className="stat-card">
          <div className="stat-title">Available Course Documents</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{documents.length}</div>
          <div className="stat-desc">Uploaded by department faculty</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Department Courses</div>
          <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>{courses.length}</div>
          <div className="stat-desc">Active cataloged courses</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Faculty Staff</div>
          <div className="stat-value">{facultyUsers.length}</div>
          <div className="stat-desc">Department members</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Generated Question Papers</div>
          <div className="stat-value" style={{ color: 'var(--status-active)' }}>{generatedQPs.length}</div>
          <div className="stat-desc">Stored in department archives</div>
        </div>
      </div>

      {/* Available Documents Section */}
      <div className="card-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Available Faculty Course Documents</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Materials uploaded by faculty for question synthesis and examination assessment.
          </p>
        </div>

        {/* Filter by course */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filter Course:</label>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="form-control"
            style={{ minWidth: '200px' }}
          >
            <option value="all">All Courses ({documents.length})</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.course_name} ({c.course_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Loader message="Loading department document records..." />
      ) : filteredDocs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>📂</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            No Uploaded Documents Available
          </div>
          <p style={{ fontSize: '0.92rem', marginTop: '6px', maxWidth: '500px', margin: '6px auto 0' }}>
            Faculty members have not uploaded any syllabus or course documents for this department yet. Once uploaded, they will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{
                    backgroundColor: doc.file_type === 'pdf' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: doc.file_type === 'pdf' ? '#ef4444' : '#3b82f6',
                    border: `1px solid ${doc.file_type === 'pdf' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {doc.file_type}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {doc.created_at ? doc.created_at.split(' ')[0] : ''}
                  </span>
                </div>

                <h4 style={{ fontSize: '1.08rem', fontWeight: 600, marginBottom: '6px', wordBreak: 'break-word' }}>
                  {doc.title}
                </h4>
                
                <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan, #06b6d4)', fontWeight: 500, marginBottom: '6px' }}>
                  📘 {doc.course_name} ({doc.course_code})
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  👤 Uploaded by: <strong style={{ color: 'var(--text-primary)' }}>{doc.user_name}</strong>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  File: {doc.file_name} • {formatFileSize(doc.file_size)}
                </div>

                {doc.text_length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--status-active, #10b981)', marginTop: '6px', fontWeight: 500 }}>
                    ✓ Ready for Question Paper Generator ({doc.text_length.toLocaleString()} chars)
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
                  onClick={() => handleOpenPreview(doc)}
                >
                  👁️ Inspect Content
                </button>
                <a
                  href={documentService.getDownloadUrl(doc.id)}
                  download={doc.file_name}
                  className="btn btn-secondary"
                  style={{ padding: '7px 12px', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  title="Download Raw File"
                >
                  ⬇️
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `Extracted Content: ${previewDoc.title}` : 'Document Preview'}
      >
        <div>
          <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Course: <strong>{previewDoc?.course_name} ({previewDoc?.course_code})</strong> • Uploader: <strong>{previewDoc?.user_name}</strong>
          </div>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '16px',
            borderRadius: 'var(--border-radius)',
            maxHeight: '380px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            color: 'var(--text-primary)'
          }}>
            {previewDoc?.extracted_text || previewDoc?.extracted_text_preview || 'No text content available.'}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HODDashboard;
