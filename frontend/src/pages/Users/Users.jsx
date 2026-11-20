import React, { useState, useEffect } from 'react';
import { userService } from '../../services/userService';
import { branchService } from '../../services/branchService';
import { roleService } from '../../services/roleService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired, validateEmail, validateInteger, validatePhone } from '../../utils/validators';
import { HONORIFICS } from '../../utils/constants';

const Users = () => {
  const [data, setData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const initialForm = {
    per_no: '',
    honorific: 'Mr.',
    user_name: '',
    branch_id: '',
    contact: '',
    user_type: '', // Role ID
    password: '',
    email: '',
    status: 1
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, branchesRes, rolesRes] = await Promise.all([
        userService.getAll(),
        branchService.getAll(),
        roleService.getAll()
      ]);
      
      if (usersRes.success) {
        setData(usersRes.data);
      }
      if (branchesRes.success) setBranches(branchesRes.data);
      if (rolesRes.success) {
        setRoles(rolesRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load details.');
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
      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultRole = roles.find(r => (r.role_name || r.role || '').toLowerCase() === 'faculty') || roles[0];
    setFormData({
      ...initialForm,
      user_type: defaultRole ? defaultRole.id : ''
    });
    setFormErrors({});
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      per_no: item.per_no,
      honorific: item.honorific || 'Mr.',
      user_name: item.user_name || '',
      branch_id: item.branch_id || '',
      contact: item.contact || '',
      user_type: item.user_type || '',
      password: item.password || '',
      email: item.email || '',
      status: item.status
    });
    setFormErrors({});
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#';
    let pwd = 'Gmr@';
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  const handleSendCredentials = async (userRow) => {
    if (!userRow.email) {
      showNotification('User does not have a registered email address', 'error');
      return;
    }
    setSendingEmailId(userRow.id);
    try {
      const res = await userService.sendCredentials(userRow.id);
      if (res.success) {
        showNotification(res.message || `Email sent successfully to ${userRow.user_name} (${userRow.email})`);
      }
    } catch (err) {
      showNotification(err.message || 'Could not send email. Please check your internet connection.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Front-end validations
    const errors = {};
    const perNoErr = validateInteger(formData.per_no, 'Personnel Number');
    if (perNoErr) errors.per_no = perNoErr;
    
    const nameErr = validateRequired(formData.user_name, 'User Name');
    if (nameErr) errors.user_name = nameErr;
    
    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.contact);
    if (phoneErr) errors.contact = phoneErr;

    const roleErr = validateRequired(formData.user_type, 'Role');
    if (roleErr) errors.user_type = roleErr;

    if (!editingItem && !formData.password) {
      errors.password = 'Password is required for new users';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    
    // Prepare payload
    const payload = {
      ...formData,
      per_no: parseInt(formData.per_no),
      branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
      contact: formData.contact ? parseInt(formData.contact) : null,
      user_type: formData.user_type ? parseInt(formData.user_type) : null,
      status: parseInt(formData.status)
    };

    try {
      if (editingItem) {
        const res = await userService.update(editingItem.id, payload);
        if (res.success) {
          showNotification(res.message || `User ${payload.user_name} updated successfully`);
          loadData();
          setModalOpen(false);
        }
      } else {
        const res = await userService.create(payload);
        if (res.success) {
          if (res.email_sent === false) {
            showNotification(res.message, 'error');
          } else {
            showNotification(res.message || `User ${payload.user_name} created and credentials sent to ${payload.email}!`);
          }
          loadData();
          setModalOpen(false);
        }
      }
    } catch (err) {
      showNotification(err.message || 'Failed to save user. Please check the form details.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await userService.delete(deleteId);
      if (res.success) {
        showNotification(res.message || 'User deleted successfully');
        loadData();
      }
    } catch (err) {
      showNotification(err.message || 'Could not delete user. The user may be linked to courses or question papers.', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? `${branch.branch_name} (${branch.branch_code})` : 'N/A';
  };

  const getRoleLabel = (userType, roleNameFromBackend) => {
    if (roleNameFromBackend) return roleNameFromBackend;
    const role = roles.find(r => r.id === userType);
    return role ? (role.role_name || role.role) : (userType ? `Role #${userType}` : 'Unassigned');
  };

  const columns = [
    { header: 'Emp No', key: 'per_no', width: '90px' },
    { 
      header: 'Name', 
      key: 'user_name',
      render: (row) => `${row.honorific || ''} ${row.user_name || ''}`
    },
    { 
      header: 'Role', 
      key: 'user_type',
      render: (row) => {
        const roleLabel = getRoleLabel(row.user_type, row.role_name);
        return (
          <span className="user-badge" style={{
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            borderColor: 'var(--accent-purple, #8b5cf6)',
            color: 'var(--accent-purple, #8b5cf6)',
            fontWeight: 600
          }}>
            {roleLabel}
          </span>
        );
      }
    },
    { header: 'Email', key: 'email' },
    { 
      header: 'Department / Branch', 
      key: 'branch_id',
      render: (row) => getBranchName(row.branch_id)
    },
    {
      header: 'Status',
      key: 'status',
      width: '90px',
      render: (row) => (
        <span className={`status-badge ${row.status === 1 ? 'active' : 'inactive'}`}>
          {row.status === 1 ? 'Active' : 'Inactive'}
        </span>
      ),
      searchKey: 'status'
    },
    {
      header: 'Credentials Email',
      key: 'credentials_action',
      width: '150px',
      render: (row) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            padding: '5px 10px',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(99, 102, 241, 0.12)',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            cursor: sendingEmailId === row.id ? 'wait' : 'pointer'
          }}
          disabled={sendingEmailId === row.id}
          onClick={() => handleSendCredentials(row)}
          title={`Send login credentials to ${row.email}`}
        >
          {sendingEmailId === row.id ? '⏳ Sending...' : '✉️ Send to Mail'}
        </button>
      )
    }
  ];

  const branchOptions = branches
    .filter(b => b.status === 1 || (editingItem && editingItem.branch_id === b.id))
    .map(b => ({
      value: b.id,
      label: `${b.branch_name} (${b.branch_code})`
    }));

  const roleOptions = roles
    .filter(r => r.status === 1 || (editingItem && editingItem.user_type === r.id))
    .map(r => ({
      value: r.id,
      label: r.role_name || r.role
    }));

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>User Directory</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage users, roles, and automated email credentials delivery upon account setup.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add User
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
        <Loader message="Loading user details..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search users by name, email, or role..."
          searchKey="user_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit User & Credentials' : 'Add User & Dispatch Credentials'}
      >
        <form onSubmit={handleFormSubmit}>
          {/* Automated Email Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            fontSize: '0.88rem',
            lineHeight: 1.5,
            color: 'var(--text-primary)'
          }}>
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>📧</span>
            <div>
              <strong style={{ color: 'var(--accent-cyan)' }}>Automated Credentials Delivery:</strong>{' '}
              {editingItem 
                ? 'Updating the password will automatically send the new credentials to the user\'s email.' 
                : 'The username, password, and portal login link will automatically be sent to the user\'s registered email address.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <SelectInput
              label="Title"
              name="honorific"
              value={formData.honorific}
              onChange={handleFormChange}
              options={HONORIFICS}
              required
            />

            <FormInput
              label="User Name"
              name="user_name"
              value={formData.user_name}
              onChange={handleFormChange}
              placeholder="e.g. John Doe"
              error={formErrors.user_name}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Personnel Code (per_no)"
              name="per_no"
              type="number"
              value={formData.per_no}
              onChange={handleFormChange}
              placeholder="e.g. 1002"
              error={formErrors.per_no}
              required
            />

            <SelectInput
              label="Role"
              name="user_type"
              value={formData.user_type}
              onChange={handleFormChange}
              options={roleOptions}
              placeholder="Select assigned role"
              error={formErrors.user_type}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <SelectInput
              label="Department / Branch"
              name="branch_id"
              value={formData.branch_id}
              onChange={handleFormChange}
              options={branchOptions}
              placeholder="Select department"
            />

            <FormInput
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleFormChange}
              placeholder="e.g. faculty@gmrit.edu.in"
              error={formErrors.email}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Contact No (Phone)"
              name="contact"
              type="tel"
              value={formData.contact}
              onChange={handleFormChange}
              placeholder="e.g. 9876543210"
              error={formErrors.contact}
            />

            <StatusSelect
              value={formData.status}
              onChange={handleFormChange}
              required
            />
          </div>

          {/* Password with generator & toggle */}
          <div style={{ position: 'relative', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {editingItem ? 'Change Password (Optional)' : 'User Password *'}
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                🎲 Auto-Generate Password
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleFormChange}
                placeholder={editingItem ? 'Leave empty to keep existing password' : 'Enter login password for user'}
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: 'var(--text-muted)'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
            {formErrors.password && (
              <div style={{ color: 'var(--status-inactive)', fontSize: '0.8rem', marginTop: '4px' }}>
                {formErrors.password}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Save & Update' : '🚀 Create User & Send Email'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this user? User-Course assignments will lose references."
      />
    </div>
  );
};

export default Users;

