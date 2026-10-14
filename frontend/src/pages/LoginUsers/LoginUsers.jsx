import React, { useState, useEffect } from 'react';
import { loginUserService } from '../../services/loginUserService';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired, validatePassword } from '../../utils/validators';
import { USER_ROLES } from '../../utils/constants';

const LoginUsers = () => {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ user_name: '', password: '', type: 'Faculty' });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchLoginUsers = async () => {
    setLoading(true);
    try {
      const res = await loginUserService.getAll();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load login users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginUsers();
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
    setFormData({ user_name: '', password: '', type: 'Faculty' });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ user_name: item.user_name, password: '', type: item.type || 'Faculty' });
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
    const userErr = validateRequired(formData.user_name, 'Username');
    if (userErr) errors.user_name = userErr;

    // Password required only on creation
    if (!editingItem) {
      const passErr = validatePassword(formData.password);
      if (passErr) errors.password = passErr;
    } else if (formData.password) {
      const passErr = validatePassword(formData.password);
      if (passErr) errors.password = passErr;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    try {
      if (editingItem) {
        const res = await loginUserService.update(editingItem.id, formData);
        if (res.success) {
          showNotification('Credentials updated successfully');
          fetchLoginUsers();
          setModalOpen(false);
        }
      } else {
        const res = await loginUserService.create(formData);
        if (res.success) {
          showNotification('Credentials created successfully');
          fetchLoginUsers();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showNotification(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    if (currentUser && currentUser.id === deleteId) {
      showNotification('Cannot delete your own logged-in account!', 'error');
      setDeleteId(null);
      return;
    }

    try {
      const res = await loginUserService.delete(deleteId);
      if (res.success) {
        showNotification('Login credentials deleted successfully');
        fetchLoginUsers();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'ID', key: 'id', width: '80px' },
    { header: 'Username / Login ID', key: 'user_name' },
    { 
      header: 'Account Type', 
      key: 'type',
      render: (row) => (
        <span className="user-badge" style={{ 
          backgroundColor: row.type === 'Admin' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)',
          borderColor: row.type === 'Admin' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
          color: row.type === 'Admin' ? 'var(--accent-cyan)' : 'var(--accent-purple)'
        }}>
          {row.type}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Login Credentials</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage admin portal access privileges, passwords, and username credentials.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Create Credentials
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
        <Loader message="Loading security list..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search credentials by username..."
          searchKey="user_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Credentials' : 'Create Credentials'}
      >
        <form onSubmit={handleFormSubmit}>
          <FormInput
            label="Username / Login ID"
            name="user_name"
            value={formData.user_name}
            onChange={handleFormChange}
            placeholder="e.g. jdoe_admin"
            error={formErrors.user_name}
            required
            disabled={editingItem !== null} // Keep login ID static
          />

          <FormInput
            label={editingItem ? "Change Password (Optional)" : "Password"}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleFormChange}
            placeholder={editingItem ? "Leave empty to retain current password" : "Enter secure password"}
            error={formErrors.password}
            required={!editingItem}
          />

          <SelectInput
            label="Role Type"
            name="type"
            value={formData.type}
            onChange={handleFormChange}
            options={USER_ROLES}
            required
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Save Credentials' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete these login credentials? This will revoke administrative access for this user."
      />
    </div>
  );
};

export default LoginUsers;
