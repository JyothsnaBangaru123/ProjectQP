import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import QLevel from '../QLevel/QLevel';
import Blooms from '../Blooms/Blooms';

const AddonsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabParam || 'qlevel');

  useEffect(() => {
    if (tabParam && ['qlevel', 'blooms'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const tabs = [
    { key: 'qlevel', label: 'Question Difficulty Levels', icon: '📈' },
    { key: 'blooms', label: 'Blooms Taxonomy', icon: '🧠' }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>Addon Management</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Configure assessment criteria, cognitive taxonomies, and question complexity levels.
        </p>
      </div>

      {/* Tabs Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        marginBottom: '24px',
        paddingBottom: '2px',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-purple, #8b5cf6)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? '#fff' : 'var(--text-secondary, #94a3b8)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="tab-pane-container">
        {activeTab === 'qlevel' && <QLevel />}
        {activeTab === 'blooms' && <Blooms />}
      </div>
    </div>
  );
};

export default AddonsHub;
