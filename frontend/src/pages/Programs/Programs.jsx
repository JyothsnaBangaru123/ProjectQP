import React, { useState, useEffect } from 'react';
import { programService } from '../../services/programService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';

const Programs = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const res = await programService.getAll();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load programs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
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
    setFormData({ name: '', status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ name: item.name, status: item.status });
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
    const nameErr = validateRequired(formData.name, 'Program Name');
    if (nameErr) {
      setFormErrors({ name: nameErr });
      return;
    }

    setFormErrors({});
    try {
      if (editingItem) {
        const res = await programService.update(editingItem.id, formData);
        if (res.success) {
          showNotification('Program updated successfully');
          fetchPrograms();
          setModalOpen(false);
        }
      } else {
        const res = await programService.create(formData);
        if (res.success) {
          showNotification('Program created successfully');
          fetchPrograms();
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
      const res = await programService.delete(deleteId);
      if (res.success) {
        showNotification('Program deleted successfully');
        fetchPrograms();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'ID', key: 'id', width: '80px' },
    { header: 'Program Name', key: 'name' },
    {
      header: 'Status',
      key: 'status',
      width: '120px',
      render: (row) => (
        <span className={`status-badge ${row.status === 1 ? 'active' : 'inactive'}`}>
          {row.status === 1 ? 'Active' : 'Inactive'}
        </span>
      ),
      searchKey: 'status'
    }
  ];

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Programs Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage academic degree streams and divisions.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Program
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
        <Loader message="Loading programs list..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search programs..."
          searchKey="name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Program' : 'Create Program'}
      >
        <form onSubmit={handleFormSubmit}>
          <FormInput
            label="Program Name"
            name="name"
            value={formData.name}
            onChange={handleFormChange}
            placeholder="e.g. B.Tech / M.Tech"
            error={formErrors.name}
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
              {editingItem ? 'Save Changes' : 'Create Program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this program? Any associated Program-Branch mapping might lose reference."
      />
    </div>
  );
};

export default Programs;
