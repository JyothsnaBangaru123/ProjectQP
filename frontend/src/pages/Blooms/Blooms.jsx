import React, { useState, useEffect } from 'react';
import { bloomService } from '../../services/bloomService';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SelectInput from '../../components/common/SelectInput';
import StatusSelect from '../../components/common/StatusSelect';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loader from '../../components/common/Loader';
import { validateRequired } from '../../utils/validators';
import { BLOOM_LEVELS } from '../../utils/constants';

const Blooms = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ taxonomy: '', status: 1 });
  const [formErrors, setFormErrors] = useState({});

  // Confirm Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchBlooms = async () => {
    setLoading(true);
    try {
      const res = await bloomService.getAll();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load blooms taxonomy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlooms();
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
    setFormData({ taxonomy: BLOOM_LEVELS[0].value, status: 1 });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ taxonomy: item.taxonomy, status: item.status });
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
    const taxErr = validateRequired(formData.taxonomy, 'Taxonomy Level');
    if (taxErr) {
      setFormErrors({ taxonomy: taxErr });
      return;
    }

    setFormErrors({});
    try {
      if (editingItem) {
        const res = await bloomService.update(editingItem.id, formData);
        if (res.success) {
          showNotification('Bloom taxonomy level updated successfully');
          fetchBlooms();
          setModalOpen(false);
        }
      } else {
        const res = await bloomService.create(formData);
        if (res.success) {
          showNotification('Bloom taxonomy level created successfully');
          fetchBlooms();
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
      const res = await bloomService.delete(deleteId);
      if (res.success) {
        showNotification('Bloom taxonomy level deleted successfully');
        fetchBlooms();
      }
    } catch (err) {
      showNotification(err.message || 'Delete operation failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    { header: 'S.No', key: 'id', width: '80px', render: (row, idx) => idx },
    { header: 'Taxonomy Level', key: 'taxonomy' },
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Blooms Taxonomy</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage cognitive levels (e.g. Remember, Understand, Apply, Analyze, Create).</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add Bloom Level
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
        <Loader message="Loading blooms levels..." />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={handleOpenEdit}
          onDelete={(row) => setDeleteId(row.id)}
          searchPlaceholder="Search taxonomy levels..."
          searchKey="taxonomy"
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Bloom Level' : 'Create Bloom Level'}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Taxonomy Level <span className="required-star">*</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                name="taxonomy"
                value={formData.taxonomy}
                onChange={handleFormChange}
                placeholder="e.g. Remember / Understand / Apply"
                required
              />
              <select
                className="form-control"
                style={{ width: '170px' }}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData(prev => ({ ...prev, taxonomy: e.target.value }));
                  }
                }}
              >
                <option value="">Presets...</option>
                {BLOOM_LEVELS.map(bl => (
                  <option key={bl.value} value={bl.value}>{bl.label}</option>
                ))}
              </select>
            </div>
            {formErrors.taxonomy && <div className="form-error-msg">{formErrors.taxonomy}</div>}
          </div>

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
              {editingItem ? 'Save Changes' : 'Create Bloom Level'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        message="Are you sure you want to delete this blooms level?"
      />
    </div>
  );
};

export default Blooms;
