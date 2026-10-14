import React, { useState, useEffect } from 'react';
import { bcmappingService } from '../../services/bcmappingService';
import { courseService } from '../../services/courseService';
import { regulationService } from '../../services/regulationService';
import { pbmappingService } from '../../services/pbmappingService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';

const BCMappings = () => {
  const [data, setData] = useState([]);
  const [courses, setCourses] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [pbMappings, setPbMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ course_id: '', reg_id: '', pb_id: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bcRes, courseRes, regRes, pbRes] = await Promise.all([
        bcmappingService.getAll(),
        courseService.getAll(),
        regulationService.getAll(),
        pbmappingService.getAll()
      ]);

      if (bcRes.success) setData(bcRes.data);
      if (courseRes.success) setCourses(courseRes.data);
      if (regRes.success) setRegulations(regRes.data);
      if (pbRes.success) setPbMappings(pbRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load branch-course mappings.');
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
    setFormData({ course_id: '', reg_id: '', pb_id: '', status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ 
      course_id: item.course_id, 
      reg_id: item.reg_id, 
      pb_id: item.pb_id, 
      status: item.status 
    });
    setFormErrors({});
    setModalOpen(true);
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

    // Front-end validations
    const errors = {};
    const courseErr = validateRequired(formData.course_id, 'Course');
    if (courseErr) errors.course_id = courseErr;

    const regErr = validateRequired(formData.reg_id, 'Regulation');
    if (regErr) errors.reg_id = regErr;

    const pbErr = validateRequired(formData.pb_id, 'Program-Branch Mapping');
    if (pbErr) errors.pb_id = pbErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    const payload = {
      course_id: parseInt(formData.course_id),
      reg_id: parseInt(formData.reg_id),
      pb_id: parseInt(formData.pb_id),
      status: parseInt(formData.status)
    };

    try {
      if (editingItem) {
        const res = await bcmappingService.update(editingItem.id, payload);
        if (res.success) {
          showNotification('Mapping updated successfully');
          loadData();
          setModalOpen(false);
        }
      } else {
        const res = await bcmappingService.create(payload);
        if (res.success) {
          showNotification('Mapping created successfully');
          loadData();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showNotification(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await bcmappingService.delete(deleteId);
      if (res.success) {
        showNotification('Mapping deleted successfully');
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'S.No', key: 'id', width: '80px', render: (row, idx) => idx },
    { 
      header: 'Course Code', 
      key: 'course_code',
      width: '120px',
      render: (row) => row.course_code || 'N/A'
    },
    { 
      header: 'Course Name', 
      key: 'course_name',
      render: (row) => row.course_name || 'N/A'
    },
    { 
      header: 'Program / Branch (PB)', 
      key: 'pb_id',
      render: (row) => row.program_name && row.branch_name ? `${row.program_name} - ${row.branch_name}` : 'N/A'
    },
    { 
      header: 'Regulation', 
      key: 'reg_name',
      width: '110px',
      render: (row) => row.reg_name || 'N/A'
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

  const courseOptions = courses
    .filter(c => c.status === 1 || (editingItem && editingItem.course_id === c.id))
    .map(c => ({
      value: c.id,
      label: `${c.course_name} (${c.course_code})`
    }));

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

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Branch-Course Mappings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Map courses and syllabus structures directly to regulations and program branches.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Course-Branch Mapping
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
        <Loader message="Loading branch-course associations..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search mappings by course name..."
          searchKey="course_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Course-Branch Mapping' : 'Create Course-Branch Mapping'}
      >
        <form onSubmit={handleFormSubmit}>
          <SelectInput
            label="Course Syllabus Unit"
            name="course_id"
            value={formData.course_id}
            onChange={handleFormChange}
            options={courseOptions}
            placeholder="Select course unit"
            error={formErrors.course_id}
            required
          />

          <SelectInput
            label="Curriculum Regulation"
            name="reg_id"
            value={formData.reg_id}
            onChange={handleFormChange}
            options={regOptions}
            placeholder="Select syllabus regulation schema"
            error={formErrors.reg_id}
            required
          />

          <SelectInput
            label="Program-Branch Combination (PB)"
            name="pb_id"
            value={formData.pb_id}
            onChange={handleFormChange}
            options={pbOptions}
            placeholder="Select program-branch combination"
            error={formErrors.pb_id}
            required
          />

          <StatusSelect
            value={formData.status}
            onChange={handleFormChange}
            required
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Save Changes' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this branch-course association?"
      />
    </div>
  );
};

export default BCMappings;
