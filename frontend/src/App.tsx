import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/app/layouts/Layout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { PeoplePage } from '@/features/people/pages/PeoplePage';
import { PersonDetailPage } from '@/features/people/pages/PersonDetailPage';
import { AttendancePage } from '@/features/attendance/pages/AttendancePage';
import { TimesheetsPage } from '@/features/timesheets/pages/TimesheetsPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { HRPage } from '@/features/hr/pages/HRPage';
import { OrgChartPage } from '@/features/people/pages/OrgChartPage';

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  // ✅ Safe array access
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  return permissions.includes(permission) ? (
    <>{children}</>
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="people/:id" element={<PersonDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="timesheets" element={<TimesheetsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="people/org-chart" element={<OrgChartPage />} />
          <Route path="people/:id" element={<PersonDetailPage />} />

          {/* Permission-gated routes */}
          <Route
            path="users"
            element={
              <PermissionRoute permission="users.manage">
                <UsersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="hr"
            element={
              <PermissionRoute permission="hr.view_sensitive">
                <HRPage />
              </PermissionRoute>
            }
          />

          {/* Placeholders */}
          <Route path="my-work" element={<div className="p-6 text-gray-500">My Work</div>} />
          <Route path="organisations" element={<div className="p-6 text-gray-500">Organisations</div>} />
          <Route path="programmes" element={<div className="p-6 text-gray-500">Programmes</div>} />
          <Route path="events" element={<div className="p-6 text-gray-500">Events</div>} />
          <Route path="finance" element={<div className="p-6 text-gray-500">Finance</div>} />
          <Route path="reports" element={<div className="p-6 text-gray-500">Reports</div>} />
          <Route path="settings" element={<div className="p-6 text-gray-500">Settings</div>} />
        </Route>

        {/* ✅ Catch-all — unknown URLs go to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;