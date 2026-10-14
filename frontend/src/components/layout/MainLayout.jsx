import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import Navbar from '../common/Navbar';

const MainLayout = ({ title }) => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar title={title} />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
