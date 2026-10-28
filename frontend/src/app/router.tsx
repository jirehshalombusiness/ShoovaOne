import { lazy, Suspense } from 'react';
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

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  }))
);
const MyWorkPage = lazy(() =>
  import('@/features/mywork/pages/MyWorkPage').then((module) => ({
    default: module.MyWorkPage,
  }))
);
const ChatPage = lazy(() =>
  import('@/features/chat/pages/ChatPage').then((module) => ({
    default: module.ChatPage,
  }))
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  }))
);
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  }))
);
const HelpPage = lazy(() =>
  import('@/features/help/pages/HelpPage').then((module) => ({
    default: module.HelpPage,
  }))
);
const PeoplePage = lazy(() =>
  import('@/features/people/pages/PeoplePage').then((module) => ({
    default: module.PeoplePage,
  }))
);
const PersonDetailPage = lazy(() =>
  import('@/features/people/pages/PersonDetailPage').then((module) => ({
    default: module.PersonDetailPage,
  }))
);
const OrgChartPage = lazy(() =>
  import('@/features/people/pages/OrgChartPage').then((module) => ({
    default: module.OrgChartPage,
  }))
);
const NewPersonPage = lazy(() =>
  import('@/features/people/pages/NewPersonPage').then((module) => ({
    default: module.NewPersonPage,
  }))
);
const AttendancePage = lazy(() =>
  import('@/features/attendance/pages/AttendancePage').then((module) => ({
    default: module.AttendancePage,
  }))
);
const TimesheetsPage = lazy(() =>
  import('@/features/timesheets/pages/TimesheetsPage').then((module) => ({
    default: module.TimesheetsPage,
  }))
);
const TasksPage = lazy(() =>
  import('@/features/tasks/pages/TasksPage').then((module) => ({
    default: module.TasksPage,
  }))
);
const TaskDetailPage = lazy(() =>
  import('@/features/tasks/pages/TaskDetailPage').then((module) => ({
    default: module.TaskDetailPage,
  }))
);
const UsersPage = lazy(() =>
  import('@/features/users/pages/UsersPage').then((module) => ({
    default: module.UsersPage,
  }))
);
// ============================================================
// PROJECTS
// ============================================================

const ProjectsPage = lazy(() =>
  import('@/features/projects/pages/ProjectsPage').then((module) => ({
    default: module.ProjectsPage,
  }))
);
import { ProjectLayout } from '@/features/projects/layouts/ProjectLayout';
const ProjectOverview = lazy(() =>
  import('@/features/projects/pages/ProjectOverview').then((module) => ({
    default: module.ProjectOverview,
  }))
);
const ProjectTasks = lazy(() =>
  import('@/features/projects/pages/ProjectTasks').then((module) => ({
    default: module.ProjectTasks,
  }))
);
const ProjectMilestones = lazy(() =>
  import('@/features/projects/pages/ProjectMilestones').then((module) => ({
    default: module.ProjectMilestones,
  }))
);
const ProjectTeam = lazy(() =>
  import('@/features/projects/pages/ProjectTeam').then((module) => ({
    default: module.ProjectTeam,
  }))
);
const ProjectTimesheets = lazy(() =>
  import('@/features/projects/pages/ProjectTimesheets').then((module) => ({
    default: module.ProjectTimesheets,
  }))
);
const ProjectDocuments = lazy(() =>
  import('@/features/projects/pages/ProjectDocuments').then((module) => ({
    default: module.ProjectDocuments,
  }))
);
const ProjectActivity = lazy(() =>
  import('@/features/projects/pages/ProjectActivity').then((module) => ({
    default: module.ProjectActivity,
  }))
);
const ProjectSettings = lazy(() =>
  import('@/features/projects/pages/ProjectSettings').then((module) => ({
    default: module.ProjectSettings,
  }))
);
const NewProjectPage = lazy(() =>
  import('@/features/projects/pages/NewProjectPage').then((module) => ({
    default: module.NewProjectPage,
  }))
);
import { CrmLayout } from '@/features/crm/layouts/CrmLayout';
const CrmOverviewPage = lazy(() =>
  import('@/features/crm/pages/CrmOverviewPage').then((module) => ({
    default: module.CrmOverviewPage,
  }))
);
const CrmPipelinePage = lazy(() =>
  import('@/features/crm/pages/CrmPipelinePage').then((module) => ({
    default: module.CrmPipelinePage,
  }))
);
const CrmOrganisationsPage = lazy(() =>
  import('@/features/crm/pages/CrmOrganisationsPage').then((module) => ({
    default: module.CrmOrganisationsPage,
  }))
);
const CrmOrganisationDetailPage = lazy(() =>
  import('@/features/crm/pages/CrmOrganisationDetailPage').then((module) => ({
    default: module.CrmOrganisationDetailPage,
  }))
);
const CrmContactsPage = lazy(() =>
  import('@/features/crm/pages/CrmContactsPage').then((module) => ({
    default: module.CrmContactsPage,
  }))
);
const CrmReportsPage = lazy(() =>
  import('@/features/crm/pages/CrmReportsPage').then((module) => ({
    default: module.CrmReportsPage,
  }))
);
const NewOpportunityPage = lazy(() =>
  import('@/features/crm/pages/NewOpportunityPage').then((module) => ({
    default: module.NewOpportunityPage,
  }))
);
const OpportunityDetailPage = lazy(() =>
  import('@/features/crm/pages/OpportunityDetailPage').then((module) => ({
    default: module.OpportunityDetailPage,
  }))
);
// ============================================================
// /me PAGES — SELF SERVICE
// ============================================================

const MeHomePage = lazy(() =>
  import('@/features/me/pages/MeHomePage').then((module) => ({
    default: module.MeHomePage,
  }))
);
const MeTimeOffPage = lazy(() =>
  import('@/features/me/pages/MeTimeOffPage').then((module) => ({
    default: module.MeTimeOffPage,
  }))
);
const MeCompensationPage = lazy(() =>
  import('@/features/me/pages/MeCompensationPage').then((module) => ({
    default: module.MeCompensationPage,
  }))
);
const MeDevicesPage = lazy(() =>
  import('@/features/me/pages/MeDevicesPage').then((module) => ({
    default: module.MeDevicesPage,
  }))
);
const MeContractPage = lazy(() =>
  import('@/features/me/pages/MeContractPage').then((module) => ({
    default: module.MeContractPage,
  }))
);
const MeDocumentsPage = lazy(() =>
  import('@/features/me/pages/MeDocumentsPage').then((module) => ({
    default: module.MeDocumentsPage,
  }))
);
const MeProfilePage = lazy(() =>
  import('@/features/me/pages/MeProfilePage').then((module) => ({
    default: module.MeProfilePage,
  }))
);
// ============================================================
// /hr PAGES — HR ADMIN
// ============================================================

const HROverviewPage = lazy(() =>
  import('@/features/hr/pages/HROverviewPage').then((module) => ({
    default: module.HROverviewPage,
  }))
);
const HRApprovalsPage = lazy(() =>
  import('@/features/hr/pages/HRApprovalsPage').then((module) => ({
    default: module.HRApprovalsPage,
  }))
);
const HRApprovalDetailPage = lazy(() =>
  import('@/features/hr/pages/HRApprovalDetailPage').then((module) => ({
    default: module.HRApprovalDetailPage,
  }))
);
const HREmployeesPage = lazy(() =>
  import('@/features/hr/pages/HREmployeesPage').then((module) => ({
    default: module.HREmployeesPage,
  }))
);
const HREmployeeDetailPage = lazy(() =>
  import('@/features/hr/pages/HREmployeeDetailPage').then((module) => ({
    default: module.HREmployeeDetailPage,
  }))
);
const HRTimeOffPage = lazy(() =>
  import('@/features/hr/pages/HRTimeOffPage').then((module) => ({
    default: module.HRTimeOffPage,
  }))
);
const HRCelebrationsPage = lazy(() =>
  import('@/features/hr/pages/HRCelebrationsPage').then((module) => ({
    default: module.HRCelebrationsPage,
  }))
);
const HRDocumentsPage = lazy(() =>
  import('@/features/hr/pages/HRDocumentsPage').then((module) => ({
    default: module.HRDocumentsPage,
  }))
);
const HRCompensationPage = lazy(() =>
  import('@/features/hr/pages/HRCompensationPage').then((module) => ({
    default: module.HRCompensationPage,
  }))
);
const HRReportsPage = lazy(() =>
  import('@/features/hr/pages/HRReportsPage').then((module) => ({
    default: module.HRReportsPage,
  }))
);
const HRSettingsPage = lazy(() =>
  import('@/features/hr/pages/HRSettingsPage').then((module) => ({
    default: module.HRSettingsPage,
  }))
);
const HRTimesheetsOverviewPage = lazy(() =>
  import('@/features/hr/pages/HRTimesheetsOverviewPage').then((module) => ({
    default: module.HRTimesheetsOverviewPage,
  }))
);
// ============================================================
// PAYROLL
// ============================================================

const PayrollLayout = lazy(() =>
  import('@/features/payroll/PayrollLayout').then((module) => ({
    default: module.PayrollLayout,
  }))
);
const PayrollOverviewPage = lazy(() =>
  import('@/features/payroll/pages/PayrollOverviewPage').then((module) => ({
    default: module.PayrollOverviewPage,
  }))
);
const PayRunsPage = lazy(() =>
  import('@/features/payroll/pages/PayRunsPage').then((module) => ({
    default: module.PayRunsPage,
  }))
);
const PayRunDetailPage = lazy(() =>
  import('@/features/payroll/pages/PayRunDetailPage').then((module) => ({
    default: module.PayRunDetailPage,
  }))
);
const PayrollPeoplePage = lazy(() =>
  import('@/features/payroll/pages/PayrollPeoplePage').then((module) => ({
    default: module.PayrollPeoplePage,
  }))
);
const PayrollDisbursementsPage = lazy(() =>
  import('@/features/payroll/pages/PayrollDisbursementsPage').then((module) => ({
    default: module.PayrollDisbursementsPage,
  }))
);
const PayrollReportsPage = lazy(() =>
  import('@/features/payroll/pages/PayrollReportsPage').then((module) => ({
    default: module.PayrollReportsPage,
  }))
);
const PayrollConfigurationPage = lazy(() =>
  import('@/features/payroll/pages/PayrollConfigurationPage').then((module) => ({
    default: module.PayrollConfigurationPage,
  }))
);
const MePayslipsPage = lazy(() =>
  import('@/features/payroll/pages/MePayslipsPage').then((module) => ({
    default: module.MePayslipsPage,
  }))
);
// ============================================================
// FINANCE
// ============================================================

const FinanceOverviewPage = lazy(() =>
  import('@/features/finance/pages/FinanceOverviewPage').then((module) => ({
    default: module.FinanceOverviewPage,
  }))
);
import { FinanceLayout } from '@/features/finance/layouts/FinanceLayout';
const ExpensesPage = lazy(() => import('@/features/finance/pages/ExpensesPage'));
const ExpenseDetailPage = lazy(() =>
  import('@/features/finance/pages/ExpenseDetailPage').then((module) => ({
    default: module.ExpenseDetailPage,
  }))
);
const NewExpensePage = lazy(() =>
  import('@/features/finance/pages/NewExpensePage').then((module) => ({
    default: module.NewExpensePage,
  }))
);
const FundRequestsPage = lazy(() =>
  import('@/features/finance/pages/FundRequestsPage').then((module) => ({
    default: module.FundRequestsPage,
  }))
);
const NewFundRequestPage = lazy(() =>
  import('@/features/finance/pages/NewFundRequestPage').then((module) => ({
    default: module.NewFundRequestPage,
  }))
);
const FundRequestDetailPage = lazy(() =>
  import('@/features/finance/pages/FundRequestDetailPage').then((module) => ({
    default: module.FundRequestDetailPage,
  }))
);
const ApprovalsPage = lazy(() =>
  import('@/features/finance/pages/ApprovalsPage').then((module) => ({
    default: module.ApprovalsPage,
  }))
);
const DisbursementsPage = lazy(() =>
  import('@/features/finance/pages/DisbursementsPage').then((module) => ({
    default: module.DisbursementsPage,
  }))
);
const ReconciliationPage = lazy(() => import('@/features/finance/pages/ReconciliationPage'));
const ReimbursementsPage = lazy(() => import('@/features/finance/pages/ReimbursementsPage'));
const NewReimbursementPage = lazy(() =>
  import('@/features/finance/pages/NewReimbursementPage').then((module) => ({
    default: module.NewReimbursementPage,
  }))
);
const ReimbursementDetailPage = lazy(() =>
  import('@/features/finance/pages/ReimbursementDetailPage').then((module) => ({
    default: module.ReimbursementDetailPage,
  }))
);
const InvoicesPage = lazy(() => import('@/features/finance/pages/InvoicesPage'));
const NewInvoicePage = lazy(() => import('@/features/finance/pages/NewInvoicePage'));
const InvoiceDetailPage = lazy(() => import('@/features/finance/pages/InvoiceDetailPage'));
const PaymentsPage = lazy(() => import('@/features/finance/pages/PaymentsPage'));
const NewPaymentPage = lazy(() => import('@/features/finance/pages/NewPaymentPage'));
const PaymentDetailPage = lazy(() => import('@/features/finance/pages/PaymentDetailPage'));
const BudgetsPage = lazy(() => import('@/features/finance/pages/BudgetsPage'));
const NewBudgetPage = lazy(() => import('@/features/finance/pages/NewBudgetPage'));
const BudgetDetailPage = lazy(() => import('@/features/finance/pages/BudgetDetailPage'));
const EditBudgetPage = lazy(() => import('@/features/finance/pages/EditBudgetPage'));
const AllocationsPage = lazy(() => import('../features/finance/pages/AllocationsPage'));
const NewAllocationPage = lazy(() => import('../features/finance/pages/NewAllocationPage'));
const AllocationDetailPage = lazy(() => import('../features/finance/pages/AllocationDetailPage'));
const EditAllocationPage = lazy(() => import('../features/finance/pages/EditAllocationPage'));
const FinancialReportsPage = lazy(() =>
  import('../features/finance/pages/FinancialReportsPage').then((module) => ({
    default: module.FinancialReportsPage,
  }))
);
// ============================================================
// AUDIT
// ============================================================
const AuditLogsPage = lazy(() =>
  import('@/features/audit/pages/AuditLogsPage').then((module) => ({
    default: module.AuditLogsPage,
  }))
);
const RolesPermissionsPage = lazy(() =>
  import('@/features/roles/pages/RolesPermissionsPage').then((module) => ({
    default: module.RolesPermissionsPage,
  }))
);
// ============================================================

// MEETINGS
import { MeetingsLayout } from '@/features/meetings/layouts/MeetingsLayout';
const MeetingsListPage = lazy(() =>
  import('@/features/meetings/pages/MeetingsListPage').then((module) => ({
    default: module.MeetingsListPage,
  }))
);
const NewMeetingPage = lazy(() =>
  import('@/features/meetings/pages/NewMeetingPage').then((module) => ({
    default: module.NewMeetingPage,
  }))
);
const MeetingDetailPage = lazy(() =>
  import('@/features/meetings/pages/MeetingDetailPage').then((module) => ({
    default: module.MeetingDetailPage,
  }))
);
// HELPERS
// ============================================================

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900">
        {title}
      </h1>

      <p className="text-sm text-gray-500 mt-1">
        Coming soon.
      </p>
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

/**
 * Protects the main application.
 *
 * Authenticated users who still need to change their password
 * are redirected to the password-change page.
 */
function PrivateRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isAuthenticated,
    loading,
    user,
  } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

// ============================================================
// AUTHENTICATED ROUTE
// ============================================================

/**
 * Allows authenticated users to access a page even when
 * must_change_password=true.
 *
 * This is specifically needed for /change-password.
 */
function AuthenticatedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}

// ============================================================
// PUBLIC ROUTE
// ============================================================

/**
 * Protects public authentication pages from already
 * authenticated users.
 */
function PublicRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isAuthenticated,
    loading,
    user,
  } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Already authenticated — send them to their proper
  // role-based landing page.
  return (
    <Navigate
      to={landingPath(user)}
      replace
    />
  );
}

// ============================================================
// PERMISSION ROUTE
// ============================================================

/**
 * Protects routes based on the authenticated user's permissions.
 *
 * If the user does not have the required permission,
 * they are returned to their personal /me area.
 */
function PermissionRoute({
  permission,
  children,
}: {
  permission: string | string[];
  children: React.ReactNode;
}) {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  const access = useHRAccess();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowed = access.has(permission);

  return allowed ? (
    <>{children}</>
  ) : (
    <Navigate to="/me" replace />
  );
}

// ============================================================
// APP ROUTER
// ============================================================

export function AppRouter() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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

        <Route
          path="/reset-password/:token"
          element={<ResetPasswordPage />}
        />

        {/* ========================================================= */}
        {/* AUTHENTICATED — PRE-APP                                    */}
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
        {/* MAIN APPLICATION LAYOUT                                   */}
        {/* ========================================================= */}

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >

          {/* ======================================================= */}
          {/* DEFAULT / LANDING                                       */}
          {/* ======================================================= */}

          <Route
            index
            element={
              <Navigate
                to={landingPath(user)}
                replace
              />
            }
          />

          {/* ======================================================= */}
          {/* DASHBOARD — universal, portfolio-aware                  */}
          {/* ======================================================= */}

          <Route
            path="dashboard"
            element={<DashboardPage />}
          />

          {/* ======================================================= */}
          {/* MY WORK                                                 */}
          {/* ======================================================= */}

          <Route
            path="my-work"
            element={<MyWorkPage />}
          />

          {/* ======================================================= */}
          {/* CHAT                                                    */}
          {/* ======================================================= */}

          <Route
            path="chat"
            element={<ChatPage />}
          />

          <Route
            path="chat/:conversationId"
            element={<ChatPage />}
          />

          {/* ======================================================= */}
          {/* /me — SELF SERVICE                                      */}
          {/* ======================================================= */}

          <Route
            path="me"
            element={<MeLayout />}
          >
            <Route
              index
              element={<MeHomePage />}
            />

            <Route
              path="approvals"
              element={
                <HRApprovalsPage defaultScope="mine" basePath="/me/approvals" />
              }
            />

            <Route
              path="approvals/:id"
              element={<HRApprovalDetailPage backTo="/me/approvals" />}
            />

            <Route
              path="time-off"
              element={<MeTimeOffPage />}
            />

            <Route
              path="compensation"
              element={<MeCompensationPage />}
            />

            <Route
              path="payslips"
              element={<MePayslipsPage />}
            />

            <Route
              path="documents"
              element={<MeDocumentsPage />}
            />

            <Route
              path="contract"
              element={<MeContractPage />}
            />

            <Route
              path="devices"
              element={<MeDevicesPage />}
            />

            <Route
              path="profile"
              element={<MeProfilePage />}
            />
          </Route>

          {/* ======================================================= */}
          {/* /hr — HR ADMIN                                          */}
          {/* ======================================================= */}

          <Route
            path="hr"
            element={
              <PermissionRoute permission="hr.view_sensitive">
                <HRLayout />
              </PermissionRoute>
            }
          >

            <Route
              index
              element={<HROverviewPage />}
            />

            <Route
              path="approvals"
              element={
                <PermissionRoute permission="hr.view_leave">
                  <HRApprovalsPage
                    defaultScope="all"
                    allowScopeToggle
                    basePath="/hr/approvals"
                  />
                </PermissionRoute>
              }
            />

            <Route
              path="approvals/:id"
              element={
                <PermissionRoute permission="hr.view_leave">
                  <HRApprovalDetailPage />
                </PermissionRoute>
              }
            />

            <Route
              path="employees"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HREmployeesPage />
                </PermissionRoute>
              }
            />

            <Route
              path="employees/:id"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HREmployeeDetailPage />
                </PermissionRoute>
              }
            />

            <Route
              path="time-off"
              element={
                <PermissionRoute permission="hr.view_leave">
                  <HRTimeOffPage />
                </PermissionRoute>
              }
            />

            <Route
              path="celebrations"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HRCelebrationsPage />
                </PermissionRoute>
              }
            />

            <Route
              path="documents"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HRDocumentsPage />
                </PermissionRoute>
              }
            />

            <Route
              path="compensation"
              element={
                <PermissionRoute permission="hr.view_compensation">
                  <HRCompensationPage />
                </PermissionRoute>
              }
            />

            <Route
              path="timesheets"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HRTimesheetsOverviewPage />
                </PermissionRoute>
              }
            />

            <Route
              path="reports"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HRReportsPage />
                </PermissionRoute>
              }
            />

            <Route
              path="settings"
              element={
                <PermissionRoute permission="hr.view_sensitive">
                  <HRSettingsPage />
                </PermissionRoute>
              }
            />

          </Route>

        {/* ======================================================= */}
        {/* MEETINGS                                                */}
        {/* ======================================================= */}

        <Route path="meetings" element={<MeetingsLayout />}>
          <Route index element={<MeetingsListPage />} />
          <Route path="today" element={<MeetingsListPage />} />
          <Route path="past" element={<MeetingsListPage />} />
          <Route path="new" element={<NewMeetingPage />} />
          <Route path=":id" element={<MeetingDetailPage />} />
        </Route>

          {/* ======================================================= */}
          {/* PROJECTS                                                */}
          {/* ======================================================= */}

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
            <Route
              index
              element={<ProjectOverview />}
            />

            <Route
              path="tasks"
              element={<ProjectTasks />}
            />

            <Route
              path="milestones"
              element={<ProjectMilestones />}
            />

            <Route
              path="team"
              element={<ProjectTeam />}
            />

            <Route
              path="timesheets"
              element={<ProjectTimesheets />}
            />

            <Route
              path="documents"
              element={<ProjectDocuments />}
            />

            <Route
              path="activity"
              element={<ProjectActivity />}
            />

            <Route
              path="settings"
              element={<ProjectSettings />}
            />
          </Route>

          {/* ======================================================= */}
          {/* WORK                                                    */}
          {/* ======================================================= */}

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

          {/* ======================================================= */}
          {/* PEOPLE                                                  */}
          {/* ======================================================= */}

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
            element={<OrgChartPage />}
          />

          <Route
            path="people/new"
            element={
              <PermissionRoute permission="people.create">
                <NewPersonPage />
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

          {/* ======================================================= */}
          {/* BUSINESS                                                */}
          {/* ======================================================= */}

          <Route
            path="crm"
            element={
              <PermissionRoute permission="crm.view">
                <CrmLayout />
              </PermissionRoute>
            }
          >
            <Route index element={<CrmOverviewPage />} />
            <Route path="opportunities/new" element={<NewOpportunityPage />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="pipeline" element={<CrmPipelinePage />} />
            <Route path="organisations" element={<CrmOrganisationsPage />} />
            <Route
              path="organisations/:id"
              element={<CrmOrganisationDetailPage />}
            />
            <Route path="contacts" element={<CrmContactsPage />} />
            <Route path="reports" element={<CrmReportsPage />} />
            </Route>

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

          {/* ======================================================= */}
          {/* FINANCE                                                 */}
          {/* ======================================================= */}

          <Route
            path="finance"
            element={
              <PermissionRoute permission="finance.view">
                <FinanceLayout />
              </PermissionRoute>
            }
          >

            {/* Finance Overview */}
            <Route
              index
              element={<FinanceOverviewPage />}
            />

            {/* ----------------------------------------------------- */}
            {/* FUND MANAGEMENT                                       */}
            {/* ----------------------------------------------------- */}

            <Route
              path="fund-requests"
              element={<FundRequestsPage />}
            />

            <Route
              path="fund-requests/:requestId"
              element={<FundRequestDetailPage />}
            />

            <Route
              path="fund-requests/new"
              element={<NewFundRequestPage />}
            />

            <Route
              path="approvals"
              element={<ApprovalsPage />}
            />

            <Route
              path="disbursements"
              element={<DisbursementsPage />}
            />

            {/* ----------------------------------------------------- */}
            {/* EXPENDITURE                                           */}
            {/* ----------------------------------------------------- */}

            <Route
              path="expenses"
              element={<ExpensesPage />}
            />

            <Route
              path="expenses/new"
              element={<NewExpensePage />}
            />

            <Route
              path="expenses/:expenseId"
              element={<ExpenseDetailPage />}
            />

            <Route
              path="reimbursements"
              element={<ReimbursementsPage />}
            />

            <Route
              path="reimbursements/new"
              element={<NewReimbursementPage />}
            />

            <Route
              path="reimbursements/:reimbursementId"
              element={<ReimbursementDetailPage />}
            />

            {/* ----------------------------------------------------- */}
            {/* RECEIVABLES                                           */}
            {/* ----------------------------------------------------- */}

            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/new" element={<NewInvoicePage />} />
            <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payments/new" element={<NewPaymentPage />} />
            <Route
              path="payments/:paymentId"
              element={<PaymentDetailPage />}
            />


            {/* ----------------------------------------------------- */}
            {/* PLANNING                                              */}
            {/* ----------------------------------------------------- */}
            <Route
              path='/finance/budgets'
              element={<BudgetsPage />}
            />
            <Route
              path='/finance/budgets/new'
              element={<NewBudgetPage />}
            />
            <Route
              path='/finance/budgets/:budgetId'
              element={<BudgetDetailPage />}
            />
            <Route
              path='/finance/budgets/:budgetId/edit'
              element={<EditBudgetPage />}
            />
            <Route
              path="/finance/allocations"
              element={<AllocationsPage />}
            />
            <Route
              path="/finance/allocations/new"
              element={<NewAllocationPage />}
            />
            <Route
              path="/finance/allocations/:allocationId"
              element={<AllocationDetailPage />}
            />
            <Route
              path="/finance/allocations/:allocationId/edit"
              element={<EditAllocationPage />}
            />


            {/* ----------------------------------------------------- */}
            {/* REPORTING                                             */}
            {/* ----------------------------------------------------- */}

            <Route
              path="reports"
              element={<FinancialReportsPage />}
            />

            <Route
              path="reconciliation"
              element={<ReconciliationPage />}
            />

            {/* ----------------------------------------------------- */}
            {/* GOVERNANCE                                            */}
            {/* ----------------------------------------------------- */}

            <Route
              path="audit-trail"
              element={
                <Placeholder title="Financial Audit Trail" />
              }
            />

          </Route>

          {/* ======================================================= */}
          {/* PAYROLL                                                 */}
          {/* ======================================================= */}

          <Route
            path="payroll"
            element={
              <PermissionRoute
                permission={[
                  'payroll.view_all',
                  'payroll.prepare',
                  'payroll.review_hr',
                  'payroll.review_finance',
                  'payroll.approve',
                  'payroll.disburse',
                  'payroll.reports',
                  'payroll.config',
                ]}
              >
                <PayrollLayout />
              </PermissionRoute>
            }
          >
            <Route index element={<PayrollOverviewPage />} />
            <Route path="runs" element={<PayRunsPage />} />
            <Route path="runs/:runId" element={<PayRunDetailPage />} />
            <Route path="people" element={<PayrollPeoplePage />} />
            <Route path="disbursements" element={<PayrollDisbursementsPage />} />
            <Route path="reports" element={<PayrollReportsPage />} />
            <Route path="config" element={<PayrollConfigurationPage />} />
          </Route>

          {/* ======================================================= */}
          {/* SYSTEM                                                  */}
          {/* ======================================================= */}

          <Route
            path="reports"
            element={
              <Placeholder title="Reports" />
            }
          />

          <Route
            path="settings"
            element={<SettingsPage />}
          />

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
                <RolesPermissionsPage />
              </PermissionRoute>
            }
          />

          {/* ======================================================= */}
          {/* AUDIT                                                   */}
          {/* ======================================================= */}

          <Route
            path="audit"
            element={
              <PermissionRoute permission="audit.view">
                <AuditLogsPage />
              </PermissionRoute>
            }
          />

          {/* ======================================================= */}
          {/* USER MENU SHORTCUTS                                     */}
          {/* ======================================================= */}

          <Route
            path="profile"
            element={
              <Navigate
                to="/me/profile"
                replace
              />
            }
          />

          <Route
            path="notifications"
            element={<NotificationsPage />}
          />

          <Route
            path="help"
            element={<HelpPage />}
          />

        </Route>

        {/* ========================================================= */}
        {/* CATCH-ALL                                                 */}
        {/* ========================================================= */}

        <Route
          path="*"
          element={
            <Navigate to="/" replace />
          }
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
