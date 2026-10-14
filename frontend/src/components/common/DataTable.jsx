import React, { useState, useMemo, useEffect } from 'react';

const DataTable = ({
  columns = [],
  data = [],
  onEdit,
  onDelete,
  searchPlaceholder = 'Search records...',
  searchKey,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 7;

  // Search filter logic
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase().trim();
    
    return data.filter((row) => {
      if (searchKey) {
        const val = typeof searchKey === 'function' ? searchKey(row) : row[searchKey];
        return String(val || '').toLowerCase().includes(term);
      }
      
      return columns.some((col) => {
        // Run standard key lookup or render evaluation if string based
        const val = col.render ? col.render(row) : row[col.key];
        
        // Skip checking if it renders a React JSX element directly (e.g. buttons/badges)
        if (React.isValidElement(val)) {
          // If the column has a raw search index defined or search value, we can use it
          if (col.searchKey) {
            return String(row[col.searchKey] || '').toLowerCase().includes(term);
          }
          return false;
        }
        return String(val || '').toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, columns, searchKey]);

  // Reset pagination to page 1 on active searches
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="glass-card" style={{ padding: '0px', overflow: 'hidden' }}>
      {/* Search Header panel */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '20px 24px', 
        flexWrap: 'wrap', 
        gap: '16px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-control search-input"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Found: <strong style={{ color: 'var(--accent-cyan)' }}>{filteredData.length}</strong> / {data.length} records
        </div>
      </div>

      {/* Responsive table frame */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {col.render ? col.render(row, (currentPage - 1) * rowsPerPage + rowIdx + 1) : row[col.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'center' }}>
                        {onEdit && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            onClick={() => onEdit(row)}
                            title="Edit Record"
                          >
                            ✏️
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            onClick={() => onDelete(row)}
                            title="Delete Record"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}
                >
                  No records match your search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination panel */}
      <div className="pagination-panel">
        <div>
          Showing {filteredData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
          {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
        </div>
        <div className="pagination-controls">
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage === 1}
            onClick={handlePrevPage}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontWeight: 600 }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage === totalPages}
            onClick={handleNextPage}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
