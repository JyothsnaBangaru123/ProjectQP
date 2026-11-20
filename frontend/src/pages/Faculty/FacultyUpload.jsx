import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { documentService } from '../../services/documentService';
import { courseService } from '../../services/courseService';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import Modal from '../../components/common/Modal';

const FacultyUpload = () => {
  const navigate = useNavigate();
  const { user, branchName, branchId } = useAuth();
  
  const [courses, setCourses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload Form State
  const [selectedCourse, setSelectedCourse] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesRes, docsRes] = await Promise.all([
        courseService.getAll(),
        documentService.getAll({ filter: 'my' })
      ]);

      if (coursesRes.success) {
        setCourses(coursesRes.data);
      }
      if (docsRes.success) {
        setDocuments(docsRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load faculty portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docTitle) {
        // Auto-fill title from filename
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setDocTitle(cleanName);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
      showNotification('Please select a course for this document', 'error');
      return;
    }
    if (!selectedFile) {
      showNotification('Please choose a PDF or TXT file to upload', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('course_id', selectedCourse);
      formData.append('title', docTitle.trim() || selectedFile.name);

      const res = await documentService.upload(formData);
      if (res.success) {
        showNotification('Course document uploaded and processed successfully!');
        setSelectedFile(null);
        setDocTitle('');
        setSelectedCourse('');
        // Reset file input element
        const fileInput = document.getElementById('faculty-file-input');
        if (fileInput) fileInput.value = '';
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await documentService.delete(deleteId);
      if (res.success) {
        showNotification('Document removed successfully');
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Failed to delete document', 'error');
    } finally {
      setDeleteId(null);
    }
  };

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

  const courseOptions = courses
    .filter(c => c.status === 1)
    .map(c => ({
      value: c.id,
      label: `${c.course_name} (${c.course_code}) - Sem ${c.sem}`
    }));

  return (
    <div>
      {/* Welcome Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        borderRadius: 'var(--border-radius, 8px)',
        padding: '24px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              Welcome, {user?.honorific || ''} {user?.user_name || 'Faculty Member'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {branchName ? `Department: ${branchName}` : 'Upload course syllabus, lecture materials, and question banks for question paper generation.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right', marginRight: '8px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-cyan, #06b6d4)' }}>
                {documents.length}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Uploaded Documents
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/faculty/co-evaluation')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', fontSize: '0.92rem' }}
            >
              <span>🎯</span>
              <span>CO Attainment</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/faculty/evaluation')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', fontSize: '0.92rem' }}
            >
              <span>📝</span>
              <span>Student Marks Entry</span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--status-active)',
          padding: '12px 16px',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.95rem',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ✓ {successMsg}
        </div>
      )}

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

      {/* Upload Section Card */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📤</span> Upload Course Material (PDF / Text)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Upload syllabus units, topic notes, sample questions, or textbook content. The system extracts concepts to empower HOD question paper generation.
        </p>

        <form onSubmit={handleUploadSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <SelectInput
              label="Select Course"
              name="course_id"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              options={courseOptions}
              placeholder="Select target course"
              required
            />

            <FormInput
              label="Document Title"
              name="title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Unit 1: Data Structures Overview"
              required
            />
          </div>

          <div style={{
            border: '2px dashed var(--border-color, rgba(255, 255, 255, 0.15))',
            borderRadius: 'var(--border-radius, 8px)',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            marginTop: '8px',
            marginBottom: '20px',
            cursor: 'pointer'
          }}
          onClick={() => document.getElementById('faculty-file-input').click()}
          >
            <input
              id="faculty-file-input"
              type="file"
              accept=".pdf,.txt,.docx,.doc"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', color: selectedFile ? 'var(--status-active, #10b981)' : 'var(--text-primary)' }}>
              {selectedFile ? `Selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})` : 'Click to Browse or Drag & Drop File'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Supported formats: PDF (.pdf), Plain Text (.txt), Word Document (.docx)
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !selectedFile || !selectedCourse}
              style={{ minWidth: '160px' }}
            >
              {uploading ? 'Processing & Extracting...' : '🚀 Upload & Process Document'}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Documents List */}
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Uploaded Course Documents</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Documents available to HOD for question paper synthesis.</p>
        </div>
      </div>

      {loading ? (
        <Loader message="Loading your documents..." />
      ) : documents.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📂</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Documents Uploaded Yet</div>
          <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>Upload your first course document using the form above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {documents.map((doc) => (
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

                <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px', wordBreak: 'break-word' }}>
                  {doc.title}
                </h4>
                
                <div style={{ fontSize: '0.88rem', color: 'var(--accent-cyan, #06b6d4)', fontWeight: 500, marginBottom: '8px' }}>
                  📘 {doc.course_name} ({doc.course_code})
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  File: {doc.file_name} • {formatFileSize(doc.file_size)}
                </div>

                {doc.text_length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--status-active, #10b981)', marginTop: '4px' }}>
                    ✓ {doc.text_length.toLocaleString()} characters indexed for QP generator
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }}
                  onClick={() => handleOpenPreview(doc)}
                >
                  👁️ Preview Text
                </button>
                <a
                  href={documentService.getDownloadUrl(doc.id)}
                  download={doc.file_name}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  title="Download File"
                >
                  ⬇️
                </a>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={() => setDeleteId(doc.id)}
                  title="Delete Document"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `Indexed Content: ${previewDoc.title}` : 'Document Preview'}
      >
        <div>
          <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Course: <strong>{previewDoc?.course_name}</strong> • File: <strong>{previewDoc?.file_name}</strong>
          </div>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '16px',
            borderRadius: 'var(--border-radius)',
            maxHeight: '360px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            color: 'var(--text-primary)'
          }}>
            {previewDoc?.extracted_text || previewDoc?.extracted_text_preview || 'No text extracted from this file.'}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this course document? It will no longer be available for Question Paper generation."
      />
    </div>
  );
};

export default FacultyUpload;
