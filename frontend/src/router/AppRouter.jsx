import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AuthLayout from '../components/layout/AuthLayout';
import MainLayout from '../components/layout/MainLayout';

// Import Pages
import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import Users from '../pages/Users/Users';
import Roles from '../pages/Roles/Roles';
import Programs from '../pages/Programs/Programs';
import Branches from '../pages/Branches/Branches';
import Regulations from '../pages/Regulations/Regulations';
import Courses from '../pages/Courses/Courses';
import MappingsHub from '../pages/Mappings/MappingsHub';
import AddonsHub from '../pages/Addons/AddonsHub';

// HOD-Only Route Guard
const HODOnlyRoute = ({ children }) => {
  const { isHOD, loading } = useAuth();
  if (loading) return null;
  if (!isHOD) return <Navigate to="/hod/papers" replace />;
  return children;
};

// Multi-Role Portals
import FacultyUpload from '../pages/Faculty/FacultyUpload';
import HODDashboard from '../pages/HOD/HODDashboard';
import QPGenerator from '../pages/HOD/QPGenerator';
import QPHistory from '../pages/HOD/QPHistory';

// Intelligent Root / Dashboard redirect based on role
const RoleRedirect = () => {
  const { isFaculty, isHOD, loading } = useAuth();
  if (loading) return null;
  if (isFaculty) return <Navigate to="/faculty" replace />;
  if (isHOD) return <Navigate to="/hod" replace />;
  return <Dashboard />;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Protected Administration & Role-Based Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Intelligent Home / Dashboard */}
            <Route path="/dashboard" element={<RoleRedirect />} />

            {/* Faculty Portal Routes */}
            <Route path="/faculty" element={<FacultyUpload />} />
            <Route path="/faculty/upload" element={<FacultyUpload />} />

            {/* HOD Portal & Question Paper Routes */}
            <Route path="/hod" element={<HODDashboard />} />
            <Route path="/hod/generate" element={<HODOnlyRoute><QPGenerator /></HODOnlyRoute>} />
            <Route path="/hod/papers" element={<QPHistory />} />
            <Route path="/papers" element={<QPHistory />} />

            {/* Admin Master Data Routes */}
            <Route path="/users" element={<Users />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/regulations" element={<Regulations />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/mappings" element={<MappingsHub />} />
            <Route path="/addons" element={<AddonsHub />} />

            {/* Direct Tab / Legacy Compatibility Redirects */}
            <Route path="/pbmappings" element={<Navigate to="/mappings?tab=pb" replace />} />
            <Route path="/bcmappings" element={<Navigate to="/mappings?tab=bc" replace />} />
            <Route path="/blooms" element={<Navigate to="/addons?tab=blooms" replace />} />
            <Route path="/qlevels" element={<Navigate to="/addons?tab=qlevel" replace />} />
          </Route>

          {/* Fallback Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRouter;
