import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { isFaculty, isHOD } = useAuth();

  // Define role-specific menus
  let menuItems = [];

  if (isFaculty) {
    menuItems = [
      { path: '/faculty', label: 'Upload Content', icon: '📤' },
      { path: '/faculty/evaluation', label: 'Student Marks Entry', icon: '📝' },
      { path: '/faculty/co-evaluation', label: 'CO Evaluation & Attainment', icon: '🎯' },
      { path: '/papers', label: 'Question Papers', icon: '🗄️' },
      { path: '/courses', label: 'Courses Catalog', icon: '📘' }
    ];
  } else if (isHOD) {
    menuItems = [
      { path: '/hod', label: 'Department Hub', icon: '📊' },
      { path: '/hod/generate', label: 'Generate Question Paper', icon: '⚡' },
      { path: '/hod/papers', label: 'QP Archives', icon: '🗄️' },
      { path: '/faculty/co-evaluation', label: 'CO Attainment Analytics', icon: '🎯' },
      { path: '/courses', label: 'Courses Catalog', icon: '📘' }
    ];
  } else {
    // Admin & Management
    menuItems = [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/users', label: 'User', icon: '👥' },
      { path: '/roles', label: 'Roles', icon: '🛡️' },
      { path: '/programs', label: 'Programs', icon: '🎓' },
      { path: '/branches', label: 'Branches', icon: '🌿' },
      { path: '/regulations', label: 'Regulations', icon: '📜' },
      { path: '/courses', label: 'Courses', icon: '📘' },
      { 
        path: '/mappings', 
        label: 'Mappings', 
        icon: '🔗',
        matchPaths: ['/mappings', '/pbmappings', '/bcmappings']
      },
      { 
        path: '/addons', 
        label: 'Addon', 
        icon: '🧩',
        matchPaths: ['/addons', '/blooms', '/qlevels']
      },
      { path: '/hod/papers', label: 'Question Papers', icon: '🗄️' },
      { path: '/faculty/co-evaluation', label: 'CO Attainment Analytics', icon: '🎯' }
    ];
  }

  const isItemActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some((p) => location.pathname.startsWith(p));
    }
    return location.pathname === item.path;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        QP Management
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const active = isItemActive(item);
          return (
            <li key={item.path} className="sidebar-item">
              <NavLink
                to={item.path}
                className={active ? 'sidebar-link active' : 'sidebar-link'}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
