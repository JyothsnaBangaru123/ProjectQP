import React, { useState, useEffect } from 'react';
import { courseService } from '../../services/courseService';
import { regulationService } from '../../services/regulationService';
import { pbmappingService } from '../../services/pbmappingService';
import { documentService } from '../../services/documentService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired, validateInteger } from '../../utils/validators';
import { COURSE_TYPES, ELECTIVE_TYPES, YEARS, SEMESTERS } from '../../utils/constants';

const getRegulationNumber = (regName) => {
  if (!regName) return '';
  const digits = regName.replace(/\D/g, '');
  return digits.length >= 2 ? digits.slice(-2) : digits;
};

const getDepartmentCode = (branchName) => {
  if (!branchName) return '';
  const name = branchName.toLowerCase();
  if (name.includes('computer science') || name.includes('cse')) return 'CS';
  if (name.includes('information technology') || name.includes('it')) return 'IT';
  if (name.includes('civil') || name.includes('ce')) return 'CE';
  if (name.includes('mechanical') || name.includes('me')) return 'ME';
  if (name.includes('electrical') || name.includes('eee')) return 'EE';
  if (name.includes('electronics') || name.includes('ece')) return 'EC';
  if (name.includes('chemical')) return 'CH';
  if (name.includes('biotechnology')) return 'BT';
  
  const words = branchName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.toLowerCase() !== 'and' && w.toLowerCase() !== 'engineering');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return branchName.substring(0, 2).toUpperCase();
};

const Courses = () => {
  const [data, setData] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [pbMappings, setPbMappings] = useState([]);
  const [courseDocumentsMap, setCourseDocumentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Attached Document in Add/Edit Course modal
  const [attachedFile, setAttachedFile] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dedicated Course Materials Modal State
  const [materialsModalCourse, setMaterialsModalCourse] = useState(null);
  const [materialsList, setMaterialsList] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [newMaterialFile, setNewMaterialFile] = useState(null);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteDocId, setDeleteDocId] = useState(null);

  const initialForm = {
    course_code: '',
    course_code_suffix: '',
    course_name: '',
    course_desc: '',
    year: 1,
    sem: 1,
    course_type: 'Theory',
    elective_type: 'Core',
    credits: '',
    pb_id: '',
    reg_id: '',
    status: 1
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesRes, regsRes, pbsRes, docsRes] = await Promise.all([
        courseService.getAll(),
        regulationService.getAll(),
        pbmappingService.getAll(),
        documentService.getAll()
      ]);

      if (coursesRes.success) setData(coursesRes.data);
      if (regsRes.success) setRegulations(regsRes.data);
      if (pbsRes.success) setPbMappings(pbsRes.data);
      if (docsRes.success && Array.isArray(docsRes.data)) {
        const mapping = {};
        docsRes.data.forEach(doc => {
          if (doc.course_id) {
            if (!mapping[doc.course_id]) mapping[doc.course_id] = [];
            mapping[doc.course_id].push(doc);
          }
        });
        setCourseDocumentsMap(mapping);
      }
    } catch (err) {
      setError(err.message || 'Failed to load courses.');
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

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(initialForm);
    setAttachedFile(null);
    setDocTitle('');
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const code = item.course_code || '';
    const suffix = code.length >= 2 ? code.slice(-2) : code;
    setFormData({
      course_code: code,
      course_code_suffix: suffix,
      course_name: item.course_name || '',
      course_desc: item.course_desc || '',
      year: item.year || 1,
      sem: item.sem || 1,
      course_type: item.course_type || 'Theory',
      elective_type: item.elective_type || 'Core',
      credits: item.credits || '',
      pb_id: item.pb_id || '',
      reg_id: item.reg_id || '',
      status: item.status
    });
    setAttachedFile(null);
    setDocTitle('');
    setFormErrors({});
    setModalOpen(true);
  };

  // Open Materials Modal for a Course
  const handleOpenMaterialsModal = async (course) => {
    setMaterialsModalCourse(course);
    setMaterialsLoading(true);
    setNewMaterialFile(null);
    setNewMaterialTitle('');
    try {
      const res = await documentService.getByCourse(course.id);
      if (res.success) {
        setMaterialsList(res.data);
      }
    } catch (err) {
      showNotification('Failed to load course materials', 'error');
    } finally {
      setMaterialsLoading(false);
    }
  };

  // Upload Material inside Materials Modal
  const handleUploadModalMaterial = async (e) => {
    e.preventDefault();
    if (!materialsModalCourse || !newMaterialFile) {
      showNotification('Please choose a file to upload', 'error');
      return;
    }

    setUploadingMaterial(true);
    try {
      const form = new FormData();
      form.append('file', newMaterialFile);
      form.append('course_id', materialsModalCourse.id);
      form.append('title', newMaterialTitle.trim() || newMaterialFile.name);

      const res = await documentService.upload(form);
      if (res.success) {
        showNotification('Course document uploaded and stored in database successfully!');
        setNewMaterialFile(null);
        setNewMaterialTitle('');
        const fileInp = document.getElementById('modal-course-mat-file');
        if (fileInp) fileInp.value = '';
        
        // Refresh list
        const updated = await documentService.getByCourse(materialsModalCourse.id);
        if (updated.success) setMaterialsList(updated.data);
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Failed to upload document', 'error');
    } finally {
      setUploadingMaterial(false);
    }
  };

  // Delete Material
  const handleDeleteMaterial = async () => {
    if (!deleteDocId) return;
    try {
      const res = await documentService.delete(deleteDocId);
      if (res.success) {
        showNotification('Document deleted successfully');
        if (materialsModalCourse) {
          const updated = await documentService.getByCourse(materialsModalCourse.id);
          if (updated.success) setMaterialsList(updated.data);
        }
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Failed to delete document', 'error');
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Resolve prefix parts
    const selectedReg = regulations.find(r => r.id === parseInt(formData.reg_id));
    const regName = selectedReg ? selectedReg.reg : '';
    const regPart = getRegulationNumber(regName);

    const selectedPb = pbMappings.find(p => p.id === parseInt(formData.pb_id));
    const branchName = selectedPb ? selectedPb.branch_name : '';
    const deptPart = getDepartmentCode(branchName);

    const semPart = formData.sem ? String(formData.sem) : '';
    const prefix = `${regPart}${deptPart}${semPart}`;
    const fullCode = `${prefix}${formData.course_code_suffix || ''}`;

    // Front-end validations
    const errors = {};
    
    if (!formData.course_code_suffix) {
      errors.course_code = 'Manual suffix (last 2 digits) is required';
    } else if (formData.course_code_suffix.length !== 2) {
      errors.course_code = 'Suffix must be exactly 2 characters';
    } else if (fullCode.length !== 7 || !regPart || !deptPart || !semPart) {
      errors.course_code = 'Course code must be exactly 7 characters (Regulation, Branch, and Semester must be selected)';
    }

    const nameErr = validateRequired(formData.course_name, 'Course Name');
    if (nameErr) errors.course_name = nameErr;

    const creditsErr = validateInteger(formData.credits, 'Credits');
    if (creditsErr) errors.credits = creditsErr;

    const regErr = validateRequired(formData.reg_id, 'Regulation');
    if (regErr) errors.reg_id = regErr;

    const pbErr = validateRequired(formData.pb_id, 'Program-Branch');
    if (pbErr) errors.pb_id = pbErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    const payload = {
      ...formData,
      course_code: fullCode,
      year: parseInt(formData.year),
      sem: parseInt(formData.sem),
      credits: parseInt(formData.credits),
      pb_id: parseInt(formData.pb_id),
      reg_id: parseInt(formData.reg_id),
      status: parseInt(formData.status)
    };

    setIsSubmitting(true);
    try {
      if (editingItem) {
        const res = await courseService.update(editingItem.id, payload);
        if (res.success) {
          if (attachedFile) {
            try {
              const docFormData = new FormData();
              docFormData.append('file', attachedFile);
              docFormData.append('course_id', editingItem.id);
              docFormData.append('title', docTitle.trim() || attachedFile.name);
              await documentService.upload(docFormData);
              showNotification('Course updated and document uploaded successfully');
            } catch (docErr) {
              showNotification('Course updated, but document upload failed: ' + docErr.message, 'error');
            }
          } else {
            showNotification('Course updated successfully');
          }
          loadData();
          setModalOpen(false);
        }
      } else {
        const res = await courseService.create(payload);
        if (res.success) {
          const newCourseId = res.data?.id;
          if (attachedFile && newCourseId) {
            try {
              const docFormData = new FormData();
              docFormData.append('file', attachedFile);
              docFormData.append('course_id', newCourseId);
              docFormData.append('title', docTitle.trim() || attachedFile.name);
              await documentService.upload(docFormData);
              showNotification('Course created and syllabus document stored in database successfully!');
            } catch (docErr) {
              showNotification('Course created, but document upload failed: ' + docErr.message, 'error');
            }
          } else {
            showNotification('Course created successfully');
          }
          loadData();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showNotification(err.message || 'Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await courseService.delete(deleteId);
      if (res.success) {
        showNotification('Course deleted successfully');
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const getSemesterLabel = (sem) => {
    const s = SEMESTERS.find(x => x.value === sem);
    return s ? s.label : `Sem ${sem}`;
  };

  const columns = [
    { header: 'Code', key: 'course_code', width: '100px' },
    { header: 'Course Name', key: 'course_name' },
    { 
      header: 'Department / PB', 
      key: 'pb_id',
      render: (row) => row.program_name && row.branch_name ? `${row.program_name} - ${row.branch_name}` : 'N/A'
    },
    { header: 'Reg', key: 'reg_name', width: '80px' },
    { header: 'Credits', key: 'credits', width: '80px' },
    { 
      header: 'Sem', 
      key: 'sem', 
      width: '90px',
      render: (row) => getSemesterLabel(row.sem) 
    },
    { header: 'Type', key: 'course_type', width: '100px' },
    {
      header: 'Materials / Docs',
      key: 'materials',
      width: '140px',
      render: (row) => {
        const docsCount = (courseDocumentsMap[row.id] || []).length;
        return (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenMaterialsModal(row);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '6px',
              background: docsCount > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: docsCount > 0 ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-color)',
              color: docsCount > 0 ? '#60a5fa' : 'var(--text-secondary)'
            }}
            title="View & manage course syllabus documents in database"
          >
            <span>📁</span>
            <span>{docsCount > 0 ? `${docsCount} Docs` : '+ Add Doc'}</span>
          </button>
        );
      }
    },
    {
      header: 'Status',
      key: 'status',
      width: '100px',
      render: (row) => (
        <span className={`status-badge ${row.status === 1 ? 'active' : 'inactive'}`}>
          {row.status === 1 ? 'Active' : 'Inactive'}
        </span>
      ),
      searchKey: 'status'
    }
  ];

  const regOptions = regulations
    .filter(r => r.status === 1 || (editingItem && editingItem.reg_id === r.id))
    .map(r => ({
      value: r.id,
      label: r.reg
    }));

  const pbOptions = pbMappings
    .filter(p => p.status === 1 || (editingItem && editingItem.pb_id === p.id))
    .map(p => ({
      value: p.id,
      label: `${p.program_name} - ${p.branch_name}`
    }));

  const selectedReg = regulations.find(r => r.id === parseInt(formData.reg_id));
  const regName = selectedReg ? selectedReg.reg : '';
  const regPart = getRegulationNumber(regName);

  const selectedPb = pbMappings.find(p => p.id === parseInt(formData.pb_id));
  const branchName = selectedPb ? selectedPb.branch_name : '';
  const deptPart = getDepartmentCode(branchName);

  const semPart = formData.sem ? String(formData.sem) : '';
  const prefix = `${regPart}${deptPart}${semPart}`;
  
  const regPlaceholder = regPart || '__';
  const deptPlaceholder = deptPart || '__';
  const semPlaceholder = semPart || '_';
  const prefixToShow = `${regPlaceholder}${deptPlaceholder}${semPlaceholder}`;

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Courses Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage academic courses, credits, and syllabus materials stored in database.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Course
        </button>
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

      {loading ? (
        <Loader message="Loading courses catalog..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search courses by code or name..."
          searchKey="course_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Course' : 'Create Course'}
      >
        <form onSubmit={handleFormSubmit}>
          <FormInput
            label="Course Name"
            name="course_name"
            value={formData.course_name}
            onChange={handleFormChange}
            placeholder="e.g. Data Structures and Algorithms"
            error={formErrors.course_name}
            required
          />

          <FormInput
            label="Course Description"
            name="course_desc"
            value={formData.course_desc}
            onChange={handleFormChange}
            placeholder="Describe the scope of the course syllabus..."
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <SelectInput
              label="Regulation Schema"
              name="reg_id"
              value={formData.reg_id}
              onChange={handleFormChange}
              options={regOptions}
              placeholder="Select regulation"
              error={formErrors.reg_id}
              required
            />

            <SelectInput
              label="Program-Branch"
              name="pb_id"
              value={formData.pb_id}
              onChange={handleFormChange}
              options={pbOptions}
              placeholder="Select program-branch combination"
              error={formErrors.pb_id}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <SelectInput
              label="Year"
              name="year"
              value={formData.year}
              onChange={handleFormChange}
              options={YEARS}
              required
            />

            <SelectInput
              label="Semester"
              name="sem"
              value={formData.sem}
              onChange={handleFormChange}
              options={SEMESTERS}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                Course Code <span style={{ color: 'var(--status-inactive)' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  borderRight: 'none',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  borderTopLeftRadius: 'var(--border-radius, 6px)',
                  borderBottomLeftRadius: 'var(--border-radius, 6px)',
                  userSelect: 'none'
                }}>
                  {prefixToShow}
                </span>
                <input
                  type="text"
                  name="course_code_suffix"
                  value={formData.course_code_suffix || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    if (val.length <= 2) {
                      setFormData(prev => ({ ...prev, course_code_suffix: val }));
                    }
                  }}
                  placeholder="02"
                  className={`form-control ${formErrors.course_code ? 'is-invalid' : ''}`}
                  style={{
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    textTransform: 'uppercase'
                  }}
                  required
                />
              </div>
              {prefix && formData.course_code_suffix && formData.course_code_suffix.length === 2 && (
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Full Code: <strong style={{ color: 'var(--status-active, #10b981)' }}>{prefix}{formData.course_code_suffix}</strong>
                </div>
              )}
              {formErrors.course_code && (
                <span style={{ 
                  display: 'block', 
                  color: 'var(--status-inactive)', 
                  fontSize: '0.8rem', 
                  marginTop: '6px',
                  fontWeight: 500
                }}>
                  {formErrors.course_code}
                </span>
              )}
            </div>

            <FormInput
              label="Credits"
              name="credits"
              type="number"
              value={formData.credits}
              onChange={handleFormChange}
              placeholder="e.g. 4"
              error={formErrors.credits}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <SelectInput
              label="Course Type"
              name="course_type"
              value={formData.course_type}
              onChange={handleFormChange}
              options={COURSE_TYPES}
              required
            />

            <SelectInput
              label="Elective Type"
              name="elective_type"
              value={formData.elective_type}
              onChange={handleFormChange}
              options={ELECTIVE_TYPES}
              required
            />

            <StatusSelect
              value={formData.status}
              onChange={handleFormChange}
              required
            />
          </div>

          {/* Optional Document Upload on Course Creation */}
          <div style={{
            marginTop: '20px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px'
          }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span>📄</span> <span>Course Materials / Syllabus Document (Saved to DB)</span>
            </label>
            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
              onClick={() => document.getElementById('course-modal-file-input').click()}
            >
              <input
                id="course-modal-file-input"
                type="file"
                accept=".pdf,.txt,.docx,.doc"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAttachedFile(e.target.files[0]);
                    if (!docTitle) setDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>📤</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: attachedFile ? 'var(--status-active)' : 'var(--text-primary)' }}>
                {attachedFile ? `Selected: ${attachedFile.name} (${formatFileSize(attachedFile.size)})` : 'Click to Attach PDF, TXT, or DOCX Syllabus'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Document text will be automatically extracted and indexed into database for Question Paper Generation
              </div>
            </div>

            {attachedFile && (
              <FormInput
                label="Document Title"
                name="docTitle"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Course Syllabus & Unit Topics"
              />
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving & Processing...' : editingItem ? 'Save Changes' : 'Create Course'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dedicated Course Materials Modal */}
      <Modal
        isOpen={materialsModalCourse !== null}
        onClose={() => setMaterialsModalCourse(null)}
        title={materialsModalCourse ? `Course Materials: ${materialsModalCourse.course_name} (${materialsModalCourse.course_code})` : 'Course Materials'}
      >
        <div>
          {/* Upload New Material to this course form */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📤</span> <span>Upload Document to Course</span>
            </h4>
            <form onSubmit={handleUploadModalMaterial}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Select File (PDF, TXT, DOCX)</label>
                  <input
                    id="modal-course-mat-file"
                    type="file"
                    accept=".pdf,.txt,.docx,.doc"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNewMaterialFile(e.target.files[0]);
                        if (!newMaterialTitle) setNewMaterialTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="form-control"
                    style={{ fontSize: '0.85rem', padding: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Document Title</label>
                  <input
                    type="text"
                    value={newMaterialTitle}
                    onChange={(e) => setNewMaterialTitle(e.target.value)}
                    placeholder="e.g. Unit 1 Notes"
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploadingMaterial || !newMaterialFile}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  {uploadingMaterial ? 'Uploading...' : 'Upload to DB'}
                </button>
              </div>
            </form>
          </div>

          {/* Stored Documents List */}
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📚</span> <span>Stored Course Documents in DB ({materialsList.length})</span>
          </h4>

          {materialsLoading ? (
            <Loader message="Loading documents from database..." />
          ) : materialsList.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
              <div>No documents uploaded yet for this course.</div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Upload a syllabus PDF or notes above to store them in the database.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
              {materialsList.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: doc.file_type === 'pdf' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: doc.file_type === 'pdf' ? '#ef4444' : '#3b82f6'
                      }}>
                        {doc.file_type}
                      </span>
                      <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>{doc.title}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      File: {doc.file_name} • {formatFileSize(doc.file_size)} • Uploaded by: {doc.user_name || 'Admin'}
                    </div>
                    {doc.text_length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--status-active)', marginTop: '2px' }}>
                        ✓ {doc.text_length.toLocaleString()} characters indexed in database for question paper synthesis
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPreviewDoc(doc)}
                      title="Inspect extracted text from this file"
                    >
                      👁️ Preview Text
                    </button>
                    <a
                      href={documentService.getDownloadUrl(doc.id)}
                      download={doc.file_name}
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      title="Download file"
                    >
                      📥
                    </a>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteDocId(doc.id)}
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setMaterialsModalCourse(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Extracted Text Modal */}
      <Modal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `Indexed Content: ${previewDoc.title}` : 'Document Preview'}
      >
        <div>
          <div style={{ marginBottom: '10px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Course: <strong>{previewDoc?.course_name || materialsModalCourse?.course_name}</strong> • File: <strong>{previewDoc?.file_name}</strong>
          </div>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-color)',
            padding: '14px',
            borderRadius: 'var(--border-radius)',
            maxHeight: '340px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            color: 'var(--text-primary)'
          }}>
            {previewDoc?.extracted_text || previewDoc?.extracted_text_preview || 'No text extracted from this file.'}
          </div>
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Course Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this course? Associated Branch-Course mappings and Teacher assignments will lose reference."
      />

      {/* Delete Document Confirmation */}
      <ConfirmDialog
        isOpen={deleteDocId !== null}
        onClose={() => setDeleteDocId(null)}
        onConfirm={handleDeleteMaterial}
        message="Are you sure you want to delete this course document from the database? It will no longer be available for Question Paper generation."
      />
    </div>
  );
};

export default Courses;
