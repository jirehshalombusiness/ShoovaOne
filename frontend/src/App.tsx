import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { ProjectLayout } from '@/features/projects/layouts/ProjectLayout';
import { ProjectOverview } from '@/features/projects/pages/ProjectOverview';
import { ProjectTasks } from '@/features/projects/pages/ProjectTasks';
import { ProjectMilestones } from '@/features/projects/pages/ProjectMilestones';
import { ProjectTeam } from '@/features/projects/pages/ProjectTeam';
import { ProjectTimesheets } from '@/features/projects/pages/ProjectTimesheets';
import { ProjectDocuments } from '@/features/projects/pages/ProjectDocuments';
import { ProjectActivity } from '@/features/projects/pages/ProjectActivity';
import { ProjectSettings } from '@/features/projects/pages/ProjectSettings';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { HRPage } from '@/features/hr/pages/HRPage';
import { MyWorkPage } from '@/features/mywork/pages/MyWorkPage';
import { NewProjectPage } from '@/features/projects/pages/NewProjectPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { EmployeesPage } from '@/features/hr/pages/EmployeesPage';
import { EmployeeDetailPage } from '@/features/hr/pages/EmployeeDetailPage';


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
          <Route path="my-work" element={<MyWorkPage />} />

          {/* Work — Projects */}
          <Route path="projects" element={<ProjectsPage />} />
          <Route
            path="projects/new"
            element={<NewProjectPage />}
          />
          <Route path="projects/:id" element={<ProjectLayout />}>
            <Route index element={<ProjectOverview />} />
            <Route path="tasks" element={<ProjectTasks />} />
            <Route path="milestones" element={<ProjectMilestones />} />
            <Route path="team" element={<ProjectTeam />} />
            <Route path="timesheets" element={<ProjectTimesheets />} />
            <Route path="documents" element={<ProjectDocuments />} />
            <Route path="activity" element={<ProjectActivity />} />
            <Route path="settings" element={<ProjectSettings />} />
          </Route>

          {/* Work — Other */}
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="timesheets" element={<TimesheetsPage />} />
          <Route path="attendance" element={<AttendancePage />} />

          {/* People & HR */}
          <Route path="people" element={<PeoplePage />} />
          <Route path="people/org-chart" element={<OrgChartPage />} />
          <Route path="people/:id" element={<PersonDetailPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />

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
          <Route path="organisations" element={<Placeholder title="CRM" />} />
          <Route path="programmes" element={<Placeholder title="Programmes" />} />
          <Route path="events" element={<Placeholder title="Events" />} />
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