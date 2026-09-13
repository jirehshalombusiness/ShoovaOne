import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/app/layouts/Layout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { PeoplePage } from '@/features/people/pages/PeoplePage';
import { PersonDetailPage } from '@/features/people/pages/PersonDetailPage';
import { OrgChartPage } from '@/features/people/pages/OrgChartPage';
import { AttendancePage } from '@/features/attendance/pages/AttendancePage';
import { TimesheetsPage } from '@/features/timesheets/pages/TimesheetsPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { HRPage } from '@/features/hr/pages/HRPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPassword';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">Coming soon.</p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
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
        {/* Public */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />

         <Route
          path="/reset-password/:token"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        {/* Forced password change */}
        <Route
          path="/change-password"
          element={
            <PrivateRoute>
              <ChangePasswordPage />
            </PrivateRoute>
          }
        />

        {/* Protected */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Main */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="my-work" element={<Placeholder title="My Work" />} />

          {/* Work */}
          <Route
            path="projects"
            element={
              <PermissionRoute permission="projects.view">
                <ProjectsPage />
              </PermissionRoute>
            }
          />

          <Route
            path="tasks"
            element={
              <PermissionRoute permission="tasks.view">
                <TasksPage />
              </PermissionRoute>
            }
          />

          <Route
            path="timesheets"
            element={
              <PermissionRoute permission="timesheets.view">
                <TimesheetsPage />
              </PermissionRoute>
            }
          />

          <Route
            path="attendance"
            element={
              <PermissionRoute permission="attendance.view">
                <AttendancePage />
              </PermissionRoute>
            }
          />

          {/* People & HR */}
          <Route
            path="people"
            element={
              <PermissionRoute permission="people.view">
                <PeoplePage />
              </PermissionRoute>
            }
          />

          <Route
            path="people/org-chart"
            element={
              <PermissionRoute permission="people.view">
                <OrgChartPage />
              </PermissionRoute>
            }
          />

          <Route
            path="people/:id"
            element={
              <PermissionRoute permission="people.view">
                <PersonDetailPage />
              </PermissionRoute>
            }
          />
          {/* HR — gated */}
          <Route
            path="hr"
            element={
              <PermissionRoute permission="hr.view_sensitive">
                <HRPage />
              </PermissionRoute>
            }
          />

          {/* Business */}
          <Route
            path="organisations"
            element={
              <PermissionRoute permission="crm.view">
                <Placeholder title="CRM" />
              </PermissionRoute>
            }
          />

          <Route
            path="programmes"
            element={
              <PermissionRoute permission="programmes.view">
                <Placeholder title="Programmes" />
              </PermissionRoute>
            }
          />

          <Route
            path="events"
            element={
              <PermissionRoute permission="events.view">
                <Placeholder title="Events" />
              </PermissionRoute>
            }
          />
          <Route
            path="finance"
            element={
              <PermissionRoute permission="finance.view">
                <Placeholder title="Finance" />
              </PermissionRoute>
            }
          />

          {/* System */}
          <Route path="reports" element={<Placeholder title="Reports" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
          <Route
            path="users"
            element={
              <PermissionRoute permission="users.manage">
                <UsersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="roles"
            element={
              <PermissionRoute permission="roles.manage">
                <Placeholder title="Roles & Permissions" />
              </PermissionRoute>
            }
          />

          {/* User menu shortcuts */}
          <Route path="profile" element={<Placeholder title="My Profile" />} />
          <Route path="notifications" element={<Placeholder title="Notifications" />} />
          <Route path="help" element={<Placeholder title="Help & Support" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;