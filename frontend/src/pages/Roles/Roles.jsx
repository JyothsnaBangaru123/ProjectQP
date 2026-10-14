import React, { useState, useEffect } from 'react';
import { roleService } from '../../services/roleService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';

const Roles = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await roleService.getAll();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
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
    setFormData({ role_name: '', status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ role_name: item.role_name || item.role || '', status: item.status || 1 });
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
    const roleErr = validateRequired(formData.role_name, 'Role');
    if (roleErr) errors.role_name = roleErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    try {
      if (editingItem) {
        const res = await roleService.update(editingItem.id, {
          role_name: formData.role_name.trim(),
          status: formData.status
        });
        if (res.success) {
          showNotification('Role updated successfully');
          fetchRoles();
          setModalOpen(false);
        }
      } else {
        const res = await roleService.create({
          role_name: formData.role_name.trim(),
          status: formData.status
        });
        if (res.success) {
          showNotification('Role created successfully');
          fetchRoles();
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
      const res = await roleService.delete(deleteId);
      if (res.success) {
        showNotification('Role deleted successfully');
        fetchRoles();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'S.No', key: 'id', width: '90px', render: (row, idx) => idx },
    { 
      header: 'Role', 
      key: 'role_name',
      render: (row) => (
        <span className="user-badge" style={{ 
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          borderColor: 'var(--accent-purple, #8b5cf6)',
          color: 'var(--accent-purple, #8b5cf6)',
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.9rem'
        }}>
          {row.role_name || row.role}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Role Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure user roles and permission classifications across the system.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Role
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
        <Loader message="Loading roles..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search roles..."
          searchKey="role_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Role' : 'Add Role'}
      >
        <form onSubmit={handleFormSubmit}>
          <FormInput
            label="Role Name"
            name="role_name"
            value={formData.role_name}
            onChange={handleFormChange}
            placeholder="e.g. Dean / Examination Incharge / Faculty"
            error={formErrors.role_name}
            required
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Save Changes' : 'Add Role'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this role? Users assigned to this role may be affected."
      />
    </div>
  );
};

export default Roles;
