import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/app/layouts/Layout';

import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPassword';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { PeoplePage } from '@/features/people/pages/PeoplePage';
import { PersonDetailPage } from '@/features/people/pages/PersonDetailPage';
import { OrgChartPage } from '@/features/people/pages/OrgChartPage';
import { AttendancePage } from '@/features/attendance/pages/AttendancePage';
import { TimesheetsPage } from '@/features/timesheets/pages/TimesheetsPage';

import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectLayout } from '@/features/projects/layouts/ProjectLayout';
import { ProjectOverview } from '@/features/projects/pages/ProjectOverview';
import { ProjectTasks } from '@/features/projects/pages/ProjectTasks';
import { ProjectMilestones } from '@/features/projects/pages/ProjectMilestones';
import { ProjectTeam } from '@/features/projects/pages/ProjectTeam';
import { ProjectTimesheets } from '@/features/projects/pages/ProjectTimesheets';
import { ProjectDocuments } from '@/features/projects/pages/ProjectDocuments';
import { ProjectActivity } from '@/features/projects/pages/ProjectActivity';
import { ProjectSettings } from '@/features/projects/pages/ProjectSettings';
import { NewProjectPage } from '@/features/projects/pages/NewProjectPage';

import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { HRPage } from '@/features/hr/pages/HRPage';
import { EmployeesPage } from '@/features/hr/pages/EmployeesPage';
import { EmployeeDetailPage } from '@/features/hr/pages/EmployeeDetailPage';
import { MyWorkPage } from '@/features/mywork/pages/MyWorkPage';

// NEW — wire these up as you build them
import { AuditLogsPage } from '@/features/audit/pages/AuditLogsPage';
// import { SessionsPage } from '@/features/sessions/pages/SessionsPage';
// import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
// import { ProfilePage } from '@/features/users/pages/ProfilePage';
// import { DocumentsPage } from '@/features/documents/pages/DocumentsPage';

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

/* ------------------------------------------------------------------ */
/* Route guards                                                        */
/* ------------------------------------------------------------------ */

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.must_change_password) return <Navigate to="/change-password" replace />;

  return <>{children}</>;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <>{children}</>;

  // Already logged in — send them where they actually belong.
  return (
    <Navigate
      to={user?.must_change_password ? '/change-password' : '/dashboard'}
      replace
    />
  );
}

function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes(permission) ? (
    <>{children}</>
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ============ PUBLIC ============ */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* ============ AUTHENTICATED (pre-app) ============ */}
        <Route
          path="/change-password"
          element={<AuthenticatedRoute><ChangePasswordPage /></AuthenticatedRoute>}
        />

        {/* ============ PROTECTED APP ============ */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Main */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="my-work" element={<MyWorkPage />} />

          {/* Projects */}
          <Route
            path="projects"
            element={<PermissionRoute permission="projects.view"><ProjectsPage /></PermissionRoute>}
          />
          <Route
            path="projects/new"
            element={<PermissionRoute permission="projects.create"><NewProjectPage /></PermissionRoute>}
          />
          <Route
            path="projects/:id"
            element={<PermissionRoute permission="projects.view"><ProjectLayout /></PermissionRoute>}
          >
            <Route index element={<ProjectOverview />} />
            <Route path="tasks" element={<ProjectTasks />} />
            <Route path="milestones" element={<ProjectMilestones />} />
            <Route path="team" element={<ProjectTeam />} />
            <Route path="timesheets" element={<ProjectTimesheets />} />
            <Route path="documents" element={<ProjectDocuments />} />
            <Route path="activity" element={<ProjectActivity />} />
            <Route path="settings" element={<ProjectSettings />} />
          </Route>

          {/* Work */}
          <Route
            path="tasks"
            element={<PermissionRoute permission="tasks.view"><TasksPage /></PermissionRoute>}
          />
          <Route
            path="tasks/:id"
            element={<PermissionRoute permission="tasks.view"><TaskDetailPage /></PermissionRoute>}
          />
          <Route
            path="timesheets"
            element={<PermissionRoute permission="timesheets.view"><TimesheetsPage /></PermissionRoute>}
          />
          <Route
            path="attendance"
            element={<PermissionRoute permission="attendance.view"><AttendancePage /></PermissionRoute>}
          />

          {/* People & HR */}
          <Route
            path="people"
            element={<PermissionRoute permission="people.view"><PeoplePage /></PermissionRoute>}
          />
          <Route
            path="people/org-chart"
            element={<PermissionRoute permission="people.view"><OrgChartPage /></PermissionRoute>}
          />
          <Route
            path="people/:id"
            element={<PermissionRoute permission="people.view"><PersonDetailPage /></PermissionRoute>}
          />
          <Route
            path="employees"
            element={<PermissionRoute permission="hr.view_sensitive"><EmployeesPage /></PermissionRoute>}
          />
          <Route
            path="employees/:id"
            element={<PermissionRoute permission="hr.view_sensitive"><EmployeeDetailPage /></PermissionRoute>}
          />
          <Route
            path="hr"
            element={<PermissionRoute permission="hr.view_sensitive"><HRPage /></PermissionRoute>}
          />

          {/* Business */}
          <Route
            path="organisations"
            element={<PermissionRoute permission="crm.view"><Placeholder title="CRM" /></PermissionRoute>}
          />
          <Route
            path="programmes"
            element={<PermissionRoute permission="programmes.view"><Placeholder title="Programmes" /></PermissionRoute>}
          />
          <Route
            path="events"
            element={<PermissionRoute permission="events.view"><Placeholder title="Events" /></PermissionRoute>}
          />
          <Route
            path="finance"
            element={<PermissionRoute permission="finance.view"><Placeholder title="Finance" /></PermissionRoute>}
          />

          {/* System */}
          <Route path="reports" element={<Placeholder title="Reports" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />

          <Route
            path="users"
            element={<PermissionRoute permission="users.manage"><UsersPage /></PermissionRoute>}
          />
          <Route
            path="roles"
            element={<PermissionRoute permission="roles.manage"><Placeholder title="Roles & Permissions" /></PermissionRoute>}
          />

          {/* Audit (backend exists) */}
          <Route
            path="audit"
            element={<PermissionRoute permission="audit.view"><AuditLogsPage /></PermissionRoute>}
          />

          {/* User menu shortcuts */}
          <Route path="profile" element={<Placeholder title="My Profile" />} />
          <Route path="notifications" element={<Placeholder title="Notifications" />} />
          <Route path="help" element={<Placeholder title="Help & Support" />} />
        </Route>

        {/* Catch-all — let "/" decide (it will bounce to /login if unauthed) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;