import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { programService } from '../../services/programService';
import { branchService } from '../../services/branchService';
import { regulationService } from '../../services/regulationService';
import { courseService } from '../../services/courseService';
import { bloomService } from '../../services/bloomService';
import { userService } from '../../services/userService';
import { mappingService } from '../../services/mappingService';
import Loader from '../../components/common/Loader';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    programs: 0,
    branches: 0,
    regulations: 0,
    courses: 0,
    blooms: 0,
    users: 0,
    mappings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [programs, branches, regulations, courses, blooms, users, mappings] = await Promise.all([
          programService.getAll(),
          branchService.getAll(),
          regulationService.getAll(),
          courseService.getAll(),
          bloomService.getAll(),
          userService.getAll(),
          mappingService.getAll(),
        ]);

        setStats({
          programs: programs.data?.length || 0,
          branches: branches.data?.length || 0,
          regulations: regulations.data?.length || 0,
          courses: courses.data?.length || 0,
          blooms: blooms.data?.length || 0,
          users: users.data?.length || 0,
          mappings: mappings.data?.length || 0,
        });
      } catch (err) {
        console.error('Stats loading failed', err);
        setError('Could not retrieve database statistics. Please check database connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <Loader message="Analyzing database records..." />;

  const statCards = [
    { title: 'Programs', value: stats.programs, desc: 'Registered degree streams' },
    { title: 'Branches', value: stats.branches, desc: 'Academic departments' },
    { title: 'Regulations', value: stats.regulations, desc: 'Curriculum schemas' },
    { title: 'Courses', value: stats.courses, desc: 'Cataloged syllabus units' },
    { title: 'Blooms Taxonomy', value: stats.blooms, desc: 'Evaluations levels' },
    { title: 'Registered Users', value: stats.users, desc: 'Registered user accounts & staff' },
    { title: 'User Mappings', value: stats.mappings, desc: 'Assigned courses' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>Overview Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome to QP Management portal. Here is the overview of master data records.</p>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--status-inactive)',
          padding: '16px',
          borderRadius: 'var(--border-radius)',
          marginBottom: '28px',
          fontWeight: 500
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="stats-grid">
        {statCards.map((card, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-title">{card.title}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-desc">{card.desc}</div>
          </div>
        ))}
      </div>
      
      <div className="glass-card" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>🎯 Course Outcome (CO) Attainment Analytics</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Inspect student evaluation metrics, NBA/NAAC attainment levels, and question-outcome distributions across all academic courses.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/faculty/co-evaluation')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <span>🎯</span>
          <span>View CO Analytics</span>
        </button>
      </div>

      <div className="glass-card" style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>Database Health Check</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          The system is connected to the PostgreSQL database <strong>qpdb</strong>. All data operations are transactional. Primary keys are automatically auto-generated using database identity constraints.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
