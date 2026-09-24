import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Layout } from '@/app/layouts/Layout';
import { MeLayout } from '@/app/layouts/MeLayout';
import { HRLayout } from '@/app/layouts/HRLayout';
import { useHRAccess } from '@/hooks/useHRAccess';
import { landingPath } from '@/lib/landing';

// ============================================================
// AUTH PAGES
// ============================================================
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPassword';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

// ============================================================
// CORE PAGES
// ============================================================
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { MyWorkPage } from '@/features/mywork/pages/MyWorkPage';
import { PeoplePage } from '@/features/people/pages/PeoplePage';
import { PersonDetailPage } from '@/features/people/pages/PersonDetailPage';
import { OrgChartPage } from '@/features/people/pages/OrgChartPage';
import { NewPersonPage } from '@/features/people/pages/NewPersonPage';
import { AttendancePage } from '@/features/attendance/pages/AttendancePage';
import { TimesheetsPage } from '@/features/timesheets/pages/TimesheetsPage';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { UsersPage } from '@/features/users/pages/UsersPage';

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

// ============================================================
// /me PAGES (self-service)
// ============================================================
import { MeHomePage } from '@/features/me/pages/MeHomePage';
import { MeTimeOffPage } from '@/features/me/pages/MeTimeOffPage';
import { MeCompensationPage } from '@/features/me/pages/MeCompensationPage';
import { MeDevicesPage } from '@/features/me/pages/MeDevicesPage';
import { MeContractPage } from '@/features/me/pages/MeContractPage';
import { MeDocumentsPage } from '@/features/me/pages/MeDocumentsPage';
import { MeProfilePage } from '@/features/me/pages/MeProfilePage';

// ============================================================
// /hr PAGES (admin)
// ============================================================
import { HROverviewPage } from '@/features/hr/pages/HROverviewPage';
import { HRApprovalsPage } from '@/features/hr/pages/HRApprovalsPage';
import { HRApprovalDetailPage } from '@/features/hr/pages/HRApprovalDetailPage';
import { HREmployeesPage } from '@/features/hr/pages/HREmployeesPage';
import { HREmployeeDetailPage } from '@/features/hr/pages/HREmployeeDetailPage';
import { HRTimeOffPage } from '@/features/hr/pages/HRTimeOffPage';
import { HRCelebrationsPage } from '@/features/hr/pages/HRCelebrationsPage';
import { HRDocumentsPage } from '@/features/hr/pages/HRDocumentsPage';
import { HRCompensationPage } from '@/features/hr/pages/HRCompensationPage';
import { HRReportsPage } from '@/features/hr/pages/HRReportsPage';
import { HRSettingsPage } from '@/features/hr/pages/HRSettingsPage';

// ============================================================
// AUDIT
// ============================================================
import { AuditLogsPage } from '@/features/audit/pages/AuditLogsPage';

// ============================================================
// HELPERS
// ============================================================

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">Coming soon.</p>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ============================================================
// ROUTE GUARDS
// ============================================================

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

  // Already authenticated — send them to their proper landing page
  return <Navigate to={landingPath(user)} replace />;
}

function PermissionRoute({
  permission,
  children,
}: {
  permission: string | string[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const access = useHRAccess();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const allowed = access.has(permission);
  return allowed ? <>{children}</> : <Navigate to="/me" replace />;
}

// ============================================================
// APP ROUTER
// ============================================================

export function AppRouter() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* ========================================================= */}
        {/* PUBLIC                                                    */}
        {/* ========================================================= */}

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
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* ========================================================= */}
        {/* AUTHENTICATED (pre-app)                                   */}
        {/* ========================================================= */}

        <Route
          path="/change-password"
          element={
            <AuthenticatedRoute>
              <ChangePasswordPage />
            </AuthenticatedRoute>
          }
        />

        {/* ========================================================= */}
        {/* MAIN LAYOUT                                               */}
        {/* ========================================================= */}

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Root redirect: land on the user's proper home */}
          <Route index element={<Navigate to={landingPath(user)} replace />} />

          {/* Executive dashboard — CEO, exec_director, director only */}
          <Route
            path="dashboard"
            element={
              <PermissionRoute permission="dashboard.executive">
                <DashboardPage />
              </PermissionRoute>
            }
          />

          <Route path="my-work" element={<MyWorkPage />} />

          {/* ---------------- /me  (self-service) ------------------ */}
          <Route path="me" element={<MeLayout />}>
            <Route index element={<MeHomePage />} />
            <Route path="time-off" element={<MeTimeOffPage />} />
            <Route path="compensation" element={<MeCompensationPage />} />
            <Route path="documents" element={<MeDocumentsPage />} />
            <Route path="contract" element={<MeContractPage />} />
            <Route path="devices" element={<MeDevicesPage />} />
            <Route path="profile" element={<MeProfilePage />} />
          </Route>

          {/* ---------------- /hr  (HR admin) ---------------------- */}
          <Route
            path="hr"
            element={
              <PermissionRoute permission="hr.view_sensitive">
                <HRLayout />
              </PermissionRoute>
            }
          >
            <Route index element={<HROverviewPage />} />
            <Route path="approvals" element={<HRApprovalsPage />} />
            <Route path="approvals/:id" element={<HRApprovalDetailPage />} />
            <Route path="employees" element={<HREmployeesPage />} />
            <Route path="employees/:id" element={<HREmployeeDetailPage />} />
            <Route path="time-off" element={<HRTimeOffPage />} />
            <Route path="celebrations" element={<HRCelebrationsPage />} />
            <Route path="documents" element={<HRDocumentsPage />} />
            <Route path="compensation" element={<HRCompensationPage />} />
            <Route path="reports" element={<HRReportsPage />} />
            <Route path="settings" element={<HRSettingsPage />} />
          </Route>

          {/* ---------------- PROJECTS ----------------------------- */}
          <Route
            path="projects"
            element={
              <PermissionRoute permission="projects.view">
                <ProjectsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="projects/new"
            element={
              <PermissionRoute permission="projects.create">
                <NewProjectPage />
              </PermissionRoute>
            }
          />
          <Route
            path="projects/:id"
            element={
              <PermissionRoute permission="projects.view">
                <ProjectLayout />
              </PermissionRoute>
            }
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

          {/* ---------------- WORK --------------------------------- */}
          <Route
            path="tasks"
            element={
              <PermissionRoute permission="tasks.view">
                <TasksPage />
              </PermissionRoute>
            }
          />
          <Route
            path="tasks/:id"
            element={
              <PermissionRoute permission="tasks.view">
                <TaskDetailPage />
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

          {/* ---------------- PEOPLE -------------------------------- */}
          {/* Directory — system_admin only (people.view) */}
          <Route
            path="people"
            element={
              <PermissionRoute permission="people.view">
                <PeoplePage />
              </PermissionRoute>
            }
          />
          {/* Org chart — everyone (no permission gate) */}
          <Route path="people/org-chart" element={<OrgChartPage />} />
          {/* Add person — system_admin only */}
          <Route
            path="people/new"
            element={
              <PermissionRoute permission="people.create">
                <NewPersonPage />
              </PermissionRoute>
            }
          />
          {/* Person detail — system_admin only */}
          <Route
            path="people/:id"
            element={
              <PermissionRoute permission="people.view">
                <PersonDetailPage />
              </PermissionRoute>
            }
          />

          {/* ---------------- BUSINESS ----------------------------- */}
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

          {/* ---------------- SYSTEM ------------------------------- */}
          <Route
            path="reports"
            element={
              <PermissionRoute permission="reports.view">
                <Placeholder title="Reports" />
              </PermissionRoute>
            }
          />
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
          <Route
            path="audit"
            element={
              <PermissionRoute permission="audit.view">
                <AuditLogsPage />
              </PermissionRoute>
            }
          />

          {/* ---------------- USER MENU SHORTCUTS ------------------ */}
          <Route path="profile" element={<Navigate to="/me/profile" replace />} />
          <Route
            path="notifications"
            element={<Placeholder title="Notifications" />}
          />
          <Route path="help" element={<Placeholder title="Help & Support" />} />
        </Route>

        {/* ========================================================= */}
        {/* CATCH-ALL                                                 */}
        {/* ========================================================= */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}