import React, { useState, useEffect } from 'react';
import { branchService } from '../../services/branchService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateInteger } from '../../utils/validators';

const Branches = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ branch_code: '', branch_name: '', branch_desc: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await branchService.getAll();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
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
    setFormData({ branch_code: '', branch_name: '', branch_desc: '', status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ 
      branch_code: item.branch_code, 
      branch_name: item.branch_name || '', 
      branch_desc: item.branch_desc || '', 
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
    const codeErr = validateInteger(formData.branch_code, 'Branch Code');
    if (codeErr) {
      setFormErrors({ branch_code: codeErr });
      return;
    }

    setFormErrors({});
    try {
      if (editingItem) {
        const res = await branchService.update(editingItem.id, formData);
        if (res.success) {
          showNotification('Branch updated successfully');
          fetchBranches();
          setModalOpen(false);
        }
      } else {
        const res = await branchService.create(formData);
        if (res.success) {
          showNotification('Branch created successfully');
          fetchBranches();
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
      const res = await branchService.delete(deleteId);
      if (res.success) {
        showNotification('Branch deleted successfully');
        fetchBranches();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'S.No', key: 'id', width: '80px', render: (row, idx) => idx },
    { header: 'Branch Code', key: 'branch_code', width: '120px' },
    { header: 'Branch Name', key: 'branch_name' },
    { header: 'Description', key: 'branch_desc' },
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Branches Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage academic departments and divisions code mappings.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Branch
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
        <Loader message="Loading branches list..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search branches by code or name..."
          searchKey="branch_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Branch' : 'Create Branch'}
      >
        <form onSubmit={handleFormSubmit}>
          <FormInput
            label="Branch Code"
            name="branch_code"
            type="number"
            value={formData.branch_code}
            onChange={handleFormChange}
            placeholder="e.g. 5, 7, 12"
            error={formErrors.branch_code}
            required
          />

          <FormInput
            label="Branch Name"
            name="branch_name"
            value={formData.branch_name}
            onChange={handleFormChange}
            placeholder="e.g. Computer Science and Engineering"
            required
          />

          <FormInput
            label="Description"
            name="branch_desc"
            value={formData.branch_desc}
            onChange={handleFormChange}
            placeholder="e.g. Department of CSE"
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
              {editingItem ? 'Save Changes' : 'Create Branch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this branch? Any mappings referencing this branch will be affected."
      />
    </div>
  );
};

export default Branches;
