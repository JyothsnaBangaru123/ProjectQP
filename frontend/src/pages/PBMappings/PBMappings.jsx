import React, { useState, useEffect } from 'react';
import { pbmappingService } from '../../services/pbmappingService';
import { programService } from '../../services/programService';
import { branchService } from '../../services/branchService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';

const PBMappings = () => {
  const [data, setData] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ prog_id: '', branch_id: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pbRes, progRes, branchRes] = await Promise.all([
        pbmappingService.getAll(),
        programService.getAll(),
        branchService.getAll()
      ]);

      if (pbRes.success) setData(pbRes.data);
      if (progRes.success) setPrograms(progRes.data);
      if (branchRes.success) setBranches(branchRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load program-branch mappings.');
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
    setFormData({ prog_id: '', branch_id: '', status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ prog_id: item.prog_id, branch_id: item.branch_id, status: item.status });
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
    const progErr = validateRequired(formData.prog_id, 'Program');
    if (progErr) errors.prog_id = progErr;

    const branchErr = validateRequired(formData.branch_id, 'Branch');
    if (branchErr) errors.branch_id = branchErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    const payload = {
      prog_id: parseInt(formData.prog_id),
      branch_id: parseInt(formData.branch_id),
      status: parseInt(formData.status)
    };

    try {
      if (editingItem) {
        const res = await pbmappingService.update(editingItem.id, payload);
        if (res.success) {
          showNotification('Mapping updated successfully');
          loadData();
          setModalOpen(false);
        }
      } else {
        const res = await pbmappingService.create(payload);
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
      const res = await pbmappingService.delete(deleteId);
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
      header: 'Program Name', 
      key: 'program_name',
      render: (row) => row.program_name || 'N/A'
    },
    { 
      header: 'Branch Name', 
      key: 'branch_name',
      render: (row) => row.branch_name ? `${row.branch_name} (${row.branch_code})` : 'N/A'
    },
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

  const programOptions = programs
    .filter(p => p.status === 1 || (editingItem && editingItem.prog_id === p.id))
    .map(p => ({
      value: p.id,
      label: p.name
    }));

  const branchOptions = branches
    .filter(b => b.status === 1 || (editingItem && editingItem.branch_id === b.id))
    .map(b => ({
      value: b.id,
      label: `${b.branch_name} (${b.branch_code})`
    }));

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Program-Branch Mappings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Establish connections between degree programs and academic departments.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Mapping
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
        <Loader message="Loading program-branch associations..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search mappings by program or branch..."
          searchKey="branch_name"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Mapping' : 'Create Mapping'}
      >
        <form onSubmit={handleFormSubmit}>
          <SelectInput
            label="Degree Program"
            name="prog_id"
            value={formData.prog_id}
            onChange={handleFormChange}
            options={programOptions}
            placeholder="Select degree program"
            error={formErrors.prog_id}
            required
          />

          <SelectInput
            label="Department / Branch"
            name="branch_id"
            value={formData.branch_id}
            onChange={handleFormChange}
            options={branchOptions}
            placeholder="Select department branch"
            error={formErrors.branch_id}
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
        message="Are you sure you want to delete this program-branch mapping? Any Course mapping referencing this combination will be impacted."
      />
    </div>
  );
};

export default PBMappings;
