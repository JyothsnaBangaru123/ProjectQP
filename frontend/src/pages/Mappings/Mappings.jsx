import React, { useState, useEffect } from 'react';
import { mappingService } from '../../services/mappingService';
import { userService } from '../../services/userService';
import { courseService } from '../../services/courseService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';
import { COURSE_TYPES, ELECTIVE_TYPES, YEARS, SEMESTERS } from '../../utils/constants';

const Mappings = () => {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const initialForm = {
    faculty_id: '',
    course_id: '',
    year: 1,
    sem: 1,
    accyear: '',
    course_type: 'Theory',
    elective_type: 'Core',
    status: 1
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mapsRes, usersRes, courseRes] = await Promise.all([
        mappingService.getAll(),
        userService.getAll(),
        courseService.getAll()
      ]);

      if (mapsRes.success) setData(mapsRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (courseRes.success) setCourses(courseRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load user-course mappings.');
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
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      faculty_id: item.faculty_id || '',
      course_id: item.course_id || '',
      year: item.year || 1,
      sem: item.sem || 1,
      accyear: item.accyear || '',
      course_type: item.course_type || 'Theory',
      elective_type: item.elective_type || 'Core',
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
    const facErr = validateRequired(formData.faculty_id, 'User / Instructor');
    if (facErr) errors.faculty_id = facErr;

    const courseErr = validateRequired(formData.course_id, 'Course Unit');
    if (courseErr) errors.course_id = courseErr;

    const accErr = validateRequired(formData.accyear, 'Academic Year');
    if (accErr) errors.accyear = accErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    const payload = {
      ...formData,
      faculty_id: parseInt(formData.faculty_id),
      course_id: parseInt(formData.course_id),
      year: parseInt(formData.year),
      sem: parseInt(formData.sem),
      status: parseInt(formData.status)
    };

    try {
      if (editingItem) {
        const res = await mappingService.update(editingItem.id, payload);
        if (res.success) {
          showNotification('User course assignment updated successfully');
          loadData();
          setModalOpen(false);
        }
      } else {
        const res = await mappingService.create(payload);
        if (res.success) {
          showNotification('User course assignment created successfully');
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
      const res = await mappingService.delete(deleteId);
      if (res.success) {
        showNotification('Assignment deleted successfully');
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
    { header: 'S.No', key: 'id', width: '80px', render: (row, idx) => idx },
    { 
      header: 'Assigned User', 
      key: 'faculty_name',
      render: (row) => row.faculty_name ? `${row.faculty_name} (${row.faculty_per_no || ''})` : 'N/A'
    },
    { 
      header: 'Course Assigned', 
      key: 'course_name',
      render: (row) => row.course_name ? `${row.course_name} (${row.course_code})` : 'N/A'
    },
    { header: 'Academic Year', key: 'accyear', width: '130px' },
    { 
      header: 'Sem', 
      key: 'sem', 
      width: '90px',
      render: (row) => getSemesterLabel(row.sem) 
    },
    { header: 'Type', key: 'course_type', width: '100px' },
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

  const userOptions = users
    .filter(u => u.status === 1 || u.status === true || (editingItem && editingItem.faculty_id === u.id))
    .map(u => ({
      value: u.id,
      label: `${u.honorific || ''} ${u.user_name} (${u.per_no})`
    }));

  const courseOptions = courses
    .filter(c => c.status === 1 || (editingItem && editingItem.course_id === c.id))
    .map(c => ({
      value: c.id,
      label: `${c.course_name} (${c.course_code})`
    }));

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>User-Course Mappings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Assign registered users and instructors directly to catalog courses.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Assignment
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
        <Loader message="Loading course assignments..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search mappings by user or course name..."
          searchKey="faculty_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit User Assignment' : 'Create User Assignment'}
      >
        <form onSubmit={handleFormSubmit}>
          <SelectInput
            label="User / Instructor"
            name="faculty_id"
            value={formData.faculty_id}
            onChange={handleFormChange}
            options={userOptions}
            placeholder="Select user"
            error={formErrors.faculty_id}
            required
          />

          <SelectInput
            label="Course Unit"
            name="course_id"
            value={formData.course_id}
            onChange={handleFormChange}
            options={courseOptions}
            placeholder="Select course to assign"
            error={formErrors.course_id}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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

            <FormInput
              label="Academic Year"
              name="accyear"
              value={formData.accyear}
              onChange={handleFormChange}
              placeholder="e.g. 2024-25"
              error={formErrors.accyear}
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

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Save Assignment' : 'Assign User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this user course assignment?"
      />
    </div>
  );
};

export default Mappings;
